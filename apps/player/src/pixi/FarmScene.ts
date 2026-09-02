import type { FarmPlayerCard, PublicPlot } from "@farmhand/shared";
import {
  Container,
  Graphics,
  Sprite,
  Text,
  type Application,
} from "pixi.js";
import { ACCENTS } from "../theme";
import { ANIMAL_KINDS, CROP_KINDS, cropFrame, type Atlas, type CropKind } from "./atlas";
import { AmbientAnimal } from "./animals";
import { BIBLE } from "./draw";
import type { PixiEngine } from "./engine";
import { FxLayer } from "./fx";
import { createFarmMap } from "./tiles";

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
  private fx: FxLayer;
  private animals: AmbientAnimal[] = [];
  private rays: Graphics;
  private pointer = { x: 0.5, y: 0.5 };
  private cardNodes: CardNode[] = [];
  private store!: Sprite;
  private barn!: Sprite;
  private t = 0;
  private onPlayer: (id: string) => void;
  private onStore: () => void;
  private atlas: Atlas;
  private app: Application;

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
    this.rays = new Graphics();

    const backdrop = Sprite.from("/art/farm_backdrop.jpg");
    backdrop.anchor.set(0.5, 0.42);
    this.far.addChild(backdrop);

    this.rays.alpha = 0.28;
    this.far.addChild(this.rays);

    const map = createFarmMap(tileset);
    map.alpha = 0.9;
    this.mid.addChild(map);

    this.barn = new Sprite(atlas.frame("prop_barn"));
    this.barn.anchor.set(0.5, 1);
    this.mid.addChild(this.barn);

    this.store = new Sprite(atlas.frame("prop_store"));
    this.store.anchor.set(0.5, 1);
    this.store.eventMode = "static";
    this.store.cursor = "pointer";
    this.store.on("pointerover", () => {
      this.store.scale.set(1.06);
    });
    this.store.on("pointerout", () => {
      this.store.scale.set(1);
    });
    this.store.on("pointerdown", () => {
      this.store.scale.set(0.96);
    });
    this.store.on("pointerup", () => {
      this.store.scale.set(1.06);
      this.onStore();
    });
    this.store.on("pointerupoutside", () => this.store.scale.set(1));
    this.near.addChild(this.store);

    this.world.addChild(this.far, this.mid, this.near, this.cards, this.fx.root);
    this.root.addChild(this.world);
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.root);

    const kinds = ANIMAL_KINDS;
    kinds.forEach((kind, i) => {
      const animal = new AmbientAnimal(atlas, kind, 80 + i * 160, 0, { x: 20, y: 0, w: 980, h: 40 });
      this.animals.push(animal);
      this.near.addChild(animal.root);
    });

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
    players.forEach((player, i) => this.cardNodes[i]?.sync(player, ACCENTS[i % ACCENTS.length]));
    this.layout();
  }

  private layout() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const bg = this.far.children[0] as Sprite;
    const scale = Math.max(w / 1600, h / 900) * 1.12;
    bg.scale.set(scale);
    bg.position.set(w / 2, h * 0.46);

    this.barn.position.set(w * 0.16, h * 0.62);
    this.barn.scale.set(Math.min(0.85, w / 1400));

    this.store.position.set(w * 0.86, h * 0.96);
    this.store.scale.set(Math.min(0.72, w / 1600));

    this.mid.position.set(w * 0.5 - 36 * 32, h * 0.62);
    this.mid.scale.set(Math.max(0.5, w / 1900));

    this.animals.forEach((a, i) => {
      a.root.y = h * 0.78 + (i % 2) * 18;
    });

    const n = Math.max(1, this.cardNodes.length);
    const cardW = Math.min(248, w * 0.22);
    const gap = Math.min(28, w * 0.02);
    const total = n * cardW + (n - 1) * gap;
    const x0 = (w - total) / 2;
    this.cardNodes.forEach((node, i) => {
      node.layout(cardW, Math.min(360, h * 0.56));
      node.root.position.set(x0 + i * (cardW + gap) + cardW / 2, h * 0.5);
    });

    this.rays.clear();
    const sx = w * 0.86;
    const sy = h * 0.1;
    this.rays.position.set(sx, sy);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      this.rays.moveTo(0, 0);
      this.rays.lineTo(Math.cos(a) * 220, Math.sin(a) * 220);
    }
    this.rays.stroke({ width: 18, color: 0xffe56a, alpha: 0.18 });
  }

  private tick(dt: number) {
    this.t += dt;
    const nx = this.pointer.x - 0.5;
    const ny = this.pointer.y - 0.5;
    this.far.x = nx * -14;
    this.far.y = ny * -8 + Math.sin(this.t * 0.35) * 2;
    this.mid.x = nx * -28;
    this.mid.y = ny * -12;
    this.near.x = nx * -40;
    this.near.y = ny * -16;
    this.cards.y = Math.sin(this.t * 0.7) * 3;
    this.rays.rotation += dt * 0.08;
    this.barn.pivot.y = Math.sin(this.t * 0.6) * 4;
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
    const foot = new Container();
    foot.addChild(acorn, this.seeds, this.points);
    this.seeds.position.set(-42, -10);
    this.points.anchor.set(1, 0.5);
    foot.position.set(0, 0);
    this.root.addChild(foot);
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
    this.foot = foot;
  }

  private foot: Container;

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
      const x = -this.w * 0.28 + col * (this.w * 0.28);
      const y = -20 + row * 70;
      const mound = new Graphics();
      mound.ellipse(x, y + 28, 28, 10);
      mound.fill({ color: Number(BIBLE.soilDark.replace("#", "0x")) });
      this.plants.addChild(mound);
      const st = stageOf(plot);
      if (st) {
        const spr = new Sprite(cropFrame(this.atlas, cropKind(plot?.tier), st));
        spr.anchor.set(0.5, 0.9);
        spr.position.set(x, y + 30);
        spr.scale.set(0.42);
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
