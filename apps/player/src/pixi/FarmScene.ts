import type { FarmPlayerCard, PublicPlot } from "@farmhand/shared";
import { Container, Graphics, Sprite, Text, type Application } from "pixi.js";
import { ACCENTS } from "../theme";
import { ANIMAL_KINDS, CROP_KINDS, cropFrame, type Atlas, type CropKind } from "./atlas";
import { AmbientAnimal } from "./animals";
import type { PixiEngine } from "./engine";
import { createFenceRing } from "./fence";
import { FxLayer } from "./fx";
import { isoDepth, isoGround, isoToScreen } from "./iso";
import { createFarmMap, FARM_BARN, FARM_FENCE, FARM_PLOTS, FARM_PROPS, FARM_SHIFT, FARM_STORE } from "./tiles";

function cropKind(tier: number | null | undefined): CropKind {
  return CROP_KINDS[Math.max(0, (tier ?? 1) - 1)] ?? "daisy";
}

function stageOf(plot: PublicPlot | undefined): 1 | 2 | 3 | 4 | 0 {
  if (!plot || plot.state === "empty" || !plot.growthStage) return 0;
  return plot.growthStage;
}

export class FarmScene {
  readonly root = new Container();
  private world = new Container();
  private far = new Container();
  private mid = new Container();
  private near = new Container();
  private cards = new Container();
  private hills: Sprite;
  private fx: FxLayer;
  private animals: AmbientAnimal[] = [];
  private signs: Array<{ root: Container; label: Text }> = [];
  private pointer = { x: 0.5, y: 0.5 };
  private cardNodes: CardNode[] = [];
  private store!: Sprite;
  private barn!: Sprite;
  private map: ReturnType<typeof createFarmMap>;
  private t = 0;
  private onPlayer: (id: string) => void;
  private onStore: () => void;
  private atlas: Atlas;
  private app: Application;
  private origin = { x: 0, y: 0 };

  constructor(
    engine: PixiEngine,
    atlas: Atlas,
    tileset: import("pixi.js").Texture,
    handlers: { onPlayer: (id: string) => void; onStore: () => void },
  ) {
    this.app = engine.app;
    this.atlas = atlas;
    this.onPlayer = handlers.onPlayer;
    this.onStore = handlers.onStore;
    this.fx = new FxLayer(atlas);
    this.hills = new Sprite(atlas.frame("backdrop_hills"));

    this.map = createFarmMap(tileset);
    this.mid.addChild(this.map);
    this.mid.addChild(createFenceRing(atlas, FARM_FENCE));
    for (const prop of FARM_PROPS) {
      const spr = new Sprite(atlas.frame(prop.frame));
      spr.anchor.set(0.5, 0.9);
      const p = isoGround(prop.col, prop.row);
      spr.position.set(p.x, p.y);
      spr.scale.set(prop.scale ?? 1);
      spr.zIndex = isoDepth(prop.col, prop.row) + 4;
      this.mid.addChild(spr);
    }
    this.mid.sortableChildren = true;

    this.barn = new Sprite(atlas.frame("prop_barn"));
    this.barn.anchor.set(0.5, 0.92);
    this.mid.addChild(this.barn);

    this.store = new Sprite(atlas.frame("prop_store"));
    this.store.anchor.set(0.5, 0.92);
    this.store.eventMode = "static";
    this.store.cursor = "pointer";
    const storeLabel = new Text({
      text: "Farm Store",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 18, fill: 0xfff8ec, fontWeight: "700", stroke: { color: 0x5c3218, width: 4 } },
    });
    storeLabel.anchor.set(0.5, 0);
    storeLabel.position.set(0, 8);
    this.store.addChild(storeLabel);
    this.store.on("pointerover", () => this.store.scale.set(this.store.scale.x * 1.06));
    this.store.on("pointerout", () => this.layout());
    this.store.on("pointerdown", () => this.store.scale.set(this.store.scale.x * 0.96));
    this.store.on("pointerup", () => {
      this.layout();
      this.onStore();
    });
    this.store.on("pointerupoutside", () => this.layout());
    this.near.addChild(this.store);

    this.world.addChild(this.far, this.mid, this.near, this.cards, this.fx.root);
    this.root.addChild(this.hills, this.world);

    for (let i = 0; i < 3; i++) {
      const root = new Container();
      const spr = new Sprite(atlas.frame("prop_sign"));
      spr.anchor.set(0.5, 0.92);
      spr.scale.set(0.42);
      const label = new Text({
        text: "",
        style: {
          fontFamily: "Fredoka, sans-serif",
          fontSize: 14,
          fill: 0x5c3218,
          fontWeight: "700",
        },
      });
      label.anchor.set(0.5, 0.5);
      label.position.set(0, -40);
      root.addChild(spr, label);
      this.mid.addChild(root);
      this.signs.push({ root, label });
    }
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.root);

    // Keep yard animals in the framed homestead (barn / plots / store), not under the cards.
    const paddock = { c0: 1 + FARM_SHIFT, r0: 4 + FARM_SHIFT, c1: 11 + FARM_SHIFT, r1: 8 + FARM_SHIFT };
    const starts: Array<[number, number]> = [
      [2 + FARM_SHIFT, 5 + FARM_SHIFT],
      [7 + FARM_SHIFT, 4 + FARM_SHIFT],
      [5 + FARM_SHIFT, 5 + FARM_SHIFT],
      [9 + FARM_SHIFT, 3 + FARM_SHIFT],
      [3 + FARM_SHIFT, 7 + FARM_SHIFT],
    ];
    ANIMAL_KINDS.forEach((kind, i) => {
      const [col, row] = starts[i] ?? [4, 6];
      const animal = new AmbientAnimal(atlas, kind, col, row, paddock);
      this.animals.push(animal);
      this.near.addChild(animal.root);
    });
    this.near.sortableChildren = true;

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.onMove = (ev: { global: { x: number; y: number } }) => {
      const w = this.app.screen.width;
      const h = this.app.screen.height;
      this.pointer.x = ev.global.x / Math.max(1, w);
      this.pointer.y = ev.global.y / Math.max(1, h);
    };
    this.app.stage.on("pointermove", this.onMove);
    this.layout();
    this.onResize = () => this.layout();
    this.onTick = (ticker: { deltaMS: number }) => this.tick(ticker.deltaMS / 1000);
    this.app.renderer.on("resize", this.onResize);
    this.app.ticker.add(this.onTick);
  }

  private onMove: (ev: { global: { x: number; y: number } }) => void;
  private onResize: () => void;
  private onTick: (ticker: { deltaMS: number }) => void;

  setPlayers(players: FarmPlayerCard[]) {
    while (this.cardNodes.length < players.length) {
      const node = new CardNode(this.atlas, this.onPlayer);
      this.cards.addChild(node.root);
      this.cardNodes.push(node);
    }
    players.forEach((player, i) => {
      this.cardNodes[i]?.sync(player, ACCENTS[i % ACCENTS.length]);
      const sign = this.signs[i];
      if (sign) sign.label.text = `${player.name}'s Garden`;
    });
    this.layout();
  }

  private layout() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.hills.width = w;
    this.hills.height = h;
    this.hills.position.set(0, 0);

    const barnP = isoGround(FARM_BARN.col, FARM_BARN.row);
    const storeP = isoGround(FARM_STORE.col, FARM_STORE.row);
    const plotP = isoGround((FARM_PLOTS.c0 + FARM_PLOTS.c1) / 2, (FARM_PLOTS.r0 + FARM_PLOTS.r1) / 2);
    const cx = (barnP.x + storeP.x + plotP.x) / 3;
    const cy = (barnP.y + storeP.y + plotP.y) / 3;
    const barnHalf = 150;
    const storeHalf = 150;
    const margin = 56;
    const spread = storeP.x + storeHalf - (barnP.x - barnHalf);
    let scale = Math.max(0.58, Math.min(0.82, w / 1680, h / 980, (w - margin * 2) / Math.max(1, spread)));
    this.mid.scale.set(scale);
    this.near.scale.set(scale);
    let ox = w * 0.5 - cx * scale;
    const barnLeft = ox + barnP.x * scale - barnHalf * scale;
    const storeRight = ox + storeP.x * scale + storeHalf * scale;
    if (barnLeft < margin) ox += margin - barnLeft;
    if (storeRight > w - margin) ox -= storeRight - (w - margin);
    this.origin = { x: ox, y: h * 0.4 - cy * scale };
    this.mid.position.set(this.origin.x, this.origin.y);
    this.near.position.set(this.origin.x, this.origin.y);

    this.barn.position.set(barnP.x, barnP.y);
    this.barn.scale.set(0.62);
    this.barn.zIndex = FARM_BARN.col + FARM_BARN.row + 8;

    this.store.position.set(storeP.x, storeP.y);
    this.store.scale.set(0.58);
    this.store.zIndex = FARM_STORE.col + FARM_STORE.row + 8;

    this.signs.forEach((sign, i) => {
      const col = FARM_PLOTS.c0 + i;
      const row = FARM_FENCE.r1 + 1;
      const p = isoGround(col, row);
      sign.root.position.set(p.x, p.y);
      sign.root.zIndex = isoDepth(col, row) + 6;
    });

    this.animals.forEach((a) => a.setOrigin(0, 0));

    const n = Math.max(1, this.cardNodes.length);
    const cardW = Math.min(248, w * 0.22);
    const gap = Math.min(28, w * 0.02);
    const total = n * cardW + (n - 1) * gap;
    const x0 = (w - total) / 2;
    this.cardNodes.forEach((node, i) => {
      node.layout(cardW, Math.min(250, h * 0.3));
      node.root.position.set(x0 + i * (cardW + gap) + cardW / 2, h * 0.64);
    });
  }

  private tick(dt: number) {
    this.t += dt;
    const nx = this.pointer.x - 0.5;
    const ny = this.pointer.y - 0.5;
    this.far.x = nx * -10;
    this.far.y = ny * -6;
    this.mid.x = this.origin.x + nx * -22;
    this.mid.y = this.origin.y + ny * -12;
    this.near.x = this.origin.x + nx * -30;
    this.near.y = this.origin.y + ny * -16;
    this.cards.y = Math.sin(this.t * 0.7) * 3;
    this.hills.x = nx * -8;
    this.hills.y = ny * -4;
    this.animals.forEach((a) => a.update(dt));
    this.cardNodes.forEach((c) => c.breathe(this.t));
    this.fx.update(dt);
  }

  destroy() {
    this.app.ticker.remove(this.onTick);
    this.app.renderer.off("resize", this.onResize);
    this.app.stage.off("pointermove", this.onMove);
    this.root.removeFromParent();
    this.root.destroy({ children: true });
  }
}

class CardNode {
  readonly root = new Container();
  private frame = new Graphics();
  private shadow = new Graphics();
  private sign: Sprite;
  private nameText: Text;
  private points: Text;
  private seeds: Text;
  private can: Sprite;
  private beaker: Sprite;
  private pin: Text;
  private plants = new Container();
  private glow: Sprite;
  private playerId = "";
  private w = 220;
  private h = 320;
  private border = 0x4ea6e6;
  private foot: Container;

  constructor(private atlas: Atlas, onOpen: (id: string) => void) {
    this.sign = new Sprite(atlas.frame("prop_sign"));
    this.sign.anchor.set(0.5, 1);
    this.can = new Sprite(atlas.frame("ui_can"));
    this.beaker = new Sprite(atlas.frame("ui_beaker"));
    this.can.anchor.set(0.5);
    this.beaker.anchor.set(0.5);
    this.glow = new Sprite(atlas.frame("fx_glow"));
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.nameText = new Text({
      text: "",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 22, fill: 0xfff8ec, fontWeight: "700" },
    });
    this.nameText.anchor.set(0.5);
    this.points = new Text({
      text: "0 points",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 18, fill: 0x1f74b8, fontWeight: "700" },
    });
    this.seeds = new Text({
      text: "0",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 22, fill: 0xfff8ec, fontWeight: "800" },
    });
    this.pin = new Text({
      text: "PIN",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 14, fill: 0xffe08a, fontWeight: "700" },
    });
    this.pin.anchor.set(0.5);
    const acorn = new Sprite(atlas.frame("ui_acorn"));
    acorn.anchor.set(0.5);
    acorn.scale.set(0.55);
    acorn.position.set(-70, 0);
    this.root.addChild(this.shadow, this.frame, this.glow, this.plants, this.sign, this.nameText, this.can, this.beaker, this.pin);
    this.foot = new Container();
    this.foot.addChild(acorn, this.seeds, this.points);
    this.seeds.position.set(-42, -10);
    this.points.anchor.set(1, 0.5);
    this.root.addChild(this.foot);
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerdown", () => this.root.scale.set(0.97));
    this.root.on("pointerup", () => {
      this.root.scale.set(1);
      if (this.playerId) onOpen(this.playerId);
    });
    this.root.on("pointerupoutside", () => this.root.scale.set(1));
    this.root.on("pointerover", () => this.root.scale.set(1.03));
    this.root.on("pointerout", () => this.root.scale.set(1));
  }

  private paintFrame() {
    this.frame.clear();
    this.frame.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 28);
    this.frame.fill({ color: 0xf7fff0 });
    this.frame.stroke({ width: 10, color: this.border });
  }

  layout(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.shadow.clear();
    this.shadow.ellipse(0, h * 0.48, w * 0.46, 16);
    this.shadow.fill({ color: 0x1a2410, alpha: 0.28 });
    this.paintFrame();
    this.sign.position.set(0, -h / 2 + 8);
    this.sign.width = w * 0.92;
    this.sign.height = 48;
    this.nameText.position.set(0, -h / 2 - 8);
    this.can.position.set(-w / 2 + 28, -h / 2 + 40);
    this.can.scale.set(0.45);
    this.beaker.position.set(w / 2 - 28, -h / 2 + 40);
    this.beaker.scale.set(0.45);
    this.pin.position.set(0, -h / 2 + 42);
    this.foot.position.set(0, h / 2 - 28);
    this.points.position.set(w / 2 - 18, 0);
    this.glow.position.set(0, 10);
    this.glow.scale.set(2.2);
  }

  sync(player: FarmPlayerCard, accent: (typeof ACCENTS)[number]) {
    this.playerId = player.id;
    this.nameText.text = player.name.toUpperCase();
    this.seeds.text = String(player.seeds);
    this.points.text = `${player.points} ${player.points === 1 ? "point" : "points"}`;
    this.points.style.fill = accent.text;
    this.border = Number(accent.border.replace("#", "0x"));
    this.paintFrame();
    this.can.visible = player.canWater;
    this.beaker.visible = player.fertilizer >= 1;
    this.pin.visible = player.hasPin && !player.unlocked;
    this.plants.removeChildren();
    let ready = false;
    const plots = Array.from({ length: 6 }, (_, slot) => player.plots?.find((p) => p.slot === slot));
    plots.forEach((plot, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const p = isoToScreen(col, row, 48, 24);
      const x = p.x;
      const y = p.y - 8;
      const st = stageOf(plot);
      if (st) {
        const spr = new Sprite(cropFrame(this.atlas, cropKind(plot?.tier), st));
        spr.anchor.set(0.5, 0.86);
        spr.position.set(x, y + 36);
        spr.scale.set(0.28);
        this.plants.addChild(spr);
        if (plot?.ready) ready = true;
      }
    });
    this.glow.visible = ready;
    this.glow.alpha = ready ? 0.55 : 0;
  }

  breathe(t: number) {
    this.plants.scale.set(1 + Math.sin(t * 1.4) * 0.015);
    if (this.glow.visible) this.glow.alpha = 0.35 + Math.sin(t * 3) * 0.2;
  }
}
