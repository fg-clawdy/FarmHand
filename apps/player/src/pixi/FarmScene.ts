import { cropKindForTier, type FarmPlayerCard } from "@farmhand/shared";
import { Container, Graphics, Sprite, Text, type Application } from "pixi.js";
import { ACCENTS } from "../theme";
import { ExhaustPuff, PaintedCow } from "./ambient";
import type { Atlas } from "./atlas";
import { coverFit } from "./draw";
import type { PixiEngine } from "./engine";
import { SparkleField } from "./fx";
import { CROP_FRAME_WIDTH, cropStageFrame, type PaintedArt } from "./paintedAssets";
import {
  PLAYABLE_PLOT_SLOTS,
  PLAYFIELD_TEXTURE,
  PLAYFIELD_LAYOUT,
  gardenSignName,
  moundUv,
  uvRectToLocal,
  uvToLocal,
} from "./playfieldLayout";

export class FarmScene {
  readonly root = new Container();
  private fill = new Graphics();
  private playfield = new Container();
  private ground: Sprite;
  private hud = new Container();
  private beds: GardenHotspot[] = [];
  private cardNodes: CardChip[] = [];
  private cow: PaintedCow;
  private exhaust: ExhaustPuff;
  private store: Container;
  private app: Application;
  private onPlayer: (id: string) => void;
  private onStore: () => void;
  private t = 0;

  constructor(
    engine: PixiEngine,
    atlas: Atlas,
    painted: PaintedArt,
    handlers: { onPlayer: (id: string) => void; onStore: () => void },
  ) {
    this.app = engine.app;
    this.onPlayer = handlers.onPlayer;
    this.onStore = handlers.onStore;

    this.ground = new Sprite(painted.playfield);
    this.ground.anchor.set(0, 0);
    this.playfield.sortableChildren = true;
    this.playfield.addChild(this.ground);

    const tw = painted.playfield.width || PLAYFIELD_TEXTURE.width;
    const th = painted.playfield.height || PLAYFIELD_TEXTURE.height;

    this.exhaust = new ExhaustPuff(painted.smokeFrames);
    const tip = uvToLocal(PLAYFIELD_LAYOUT.exhaustTip, tw, th);
    this.exhaust.root.position.set(tip.x, tip.y);
    this.exhaust.root.zIndex = Math.round(tip.y + 8);
    this.playfield.addChild(this.exhaust.root);

    const roam = uvRectToLocal(PLAYFIELD_LAYOUT.cowRoam, tw, th);
    const forbidden = PLAYFIELD_LAYOUT.gardens.map((g) => uvRectToLocal(g.hit, tw, th));
    const start = uvToLocal(PLAYFIELD_LAYOUT.cowStart, tw, th);
    this.cow = new PaintedCow({ walk: painted.cowWalk, eat: painted.cowEat }, start.x, start.y, roam, forbidden);
    this.playfield.addChild(this.cow.root);

    this.store = this.makeStoreHit(tw, th);
    this.playfield.addChild(this.store);

    for (let i = 0; i < 3; i++) {
      const bed = new GardenHotspot(atlas, painted, PLAYFIELD_LAYOUT.gardens[i]!, (id) => this.onPlayer(id));
      bed.place(tw, th);
      this.beds.push(bed);
      this.playfield.addChild(bed.root);
    }

    this.root.addChild(this.fill, this.playfield, this.hud);
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.root);

    this.layout();
    this.onResize = () => this.layout();
    this.onTick = (ticker: { deltaMS: number }) => this.tick(ticker.deltaMS / 1000);
    this.app.renderer.on("resize", this.onResize);
    this.app.ticker.add(this.onTick);
  }

  private makeStoreHit(tw: number, th: number) {
    const rect = uvRectToLocal(PLAYFIELD_LAYOUT.storeHit, tw, th);
    const root = new Container();
    const hit = new Graphics();
    hit.rect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
    hit.fill({ color: 0xffffff, alpha: 0.001 });
    const label = new Text({
      text: "Farm Store",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 28,
        fill: 0xfff8ec,
        fontWeight: "700",
        stroke: { color: 0x3a2410, width: 5 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set((rect.x0 + rect.x1) / 2, rect.y0 + 18);
    root.addChild(hit, label);
    root.zIndex = 4000;
    root.eventMode = "static";
    root.cursor = "pointer";
    root.on("pointerup", () => this.onStore());
    return root;
  }

  private onResize: () => void;
  private onTick: (ticker: { deltaMS: number }) => void;

  setPlayers(players: FarmPlayerCard[]) {
    while (this.cardNodes.length < players.length) {
      const node = new CardChip(this.onPlayer);
      this.hud.addChild(node.root);
      this.cardNodes.push(node);
    }
    players.forEach((player, i) => {
      this.cardNodes[i]?.sync(player, ACCENTS[i % ACCENTS.length]);
      this.beds[i]?.sync(player, ACCENTS[i % ACCENTS.length]);
    });
    this.layout();
  }

  private layout() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    this.fill.clear();
    this.fill.rect(0, 0, w, h);
    this.fill.fill({ color: 0x3d8a32 });

    const tex = this.ground.texture;
    const tw = tex.width || PLAYFIELD_TEXTURE.width;
    const th = tex.height || PLAYFIELD_TEXTURE.height;
    const fit = coverFit(w, h, tw, th);
    this.playfield.scale.set(fit.scale);
    this.playfield.position.set(fit.x, fit.y);

    const n = Math.max(1, this.cardNodes.length);
    const cardW = Math.min(188, w * 0.18);
    const cardH = Math.min(64, h * 0.1);
    const gap = Math.min(16, w * 0.016);
    const total = n * cardW + (n - 1) * gap;
    const x0 = (w - total) / 2;
    this.cardNodes.forEach((node, i) => {
      node.layout(cardW, cardH);
      node.root.position.set(x0 + i * (cardW + gap) + cardW / 2, h - 18 - cardH / 2);
    });
  }

  private tick(dt: number) {
    this.t += dt;
    this.cow.update(dt);
    this.beds.forEach((b) => b.breathe(this.t));
  }

  destroy() {
    this.app.ticker.remove(this.onTick);
    this.app.renderer.off("resize", this.onResize);
    this.root.removeFromParent();
    this.root.destroy({ children: true });
  }
}

/** Invisible garden tap target + live name on the blank wooden sign. */
class GardenHotspot {
  readonly root = new Container();
  private hit = new Graphics();
  private nameText: Text;
  private sparkle: SparkleField;
  private plants: Sprite[] = [];
  private cropScale = 0.16;
  private playerId = "";
  private spec: (typeof PLAYFIELD_LAYOUT.gardens)[number];
  private painted: PaintedArt;

  constructor(
    atlas: Atlas,
    painted: PaintedArt,
    spec: (typeof PLAYFIELD_LAYOUT.gardens)[number],
    onOpen: (id: string) => void,
  ) {
    this.spec = spec;
    this.painted = painted;
    this.nameText = new Text({
      text: "",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 52,
        fill: 0xfff6df,
        fontWeight: "700",
        stroke: { color: 0x2a1608, width: 6 },
        dropShadow: {
          color: 0x140c06,
          alpha: 0.55,
          blur: 4,
          distance: 2,
        },
        align: "center",
      },
    });
    this.nameText.anchor.set(0.5, 0.55);
    this.sparkle = new SparkleField(atlas, 8);
    for (let i = 0; i < PLAYABLE_PLOT_SLOTS; i++) {
      const spr = new Sprite();
      spr.anchor.set(0.5, 0.9);
      spr.visible = false;
      this.plants.push(spr);
    }
    this.root.addChild(this.hit, ...this.plants, this.sparkle.root, this.nameText);
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerdown", () => this.root.scale.set(0.99));
    this.root.on("pointerup", () => {
      this.root.scale.set(1);
      if (this.playerId) onOpen(this.playerId);
    });
    this.root.on("pointerupoutside", () => this.root.scale.set(1));
  }

  place(texW: number, texH: number) {
    const rect = uvRectToLocal(this.spec.hit, texW, texH);
    const sign = uvToLocal(this.spec.sign, texW, texH);
    this.hit.clear();
    this.hit.rect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
    this.hit.fill({ color: 0xffffff, alpha: 0.001 });
    this.nameText.position.set(sign.x, sign.y);
    this.nameText.style.fontSize = Math.max(40, (rect.x1 - rect.x0) * 0.16);
    const soil = uvRectToLocal(this.spec.soil, texW, texH);
    const cellW = (soil.x1 - soil.x0) / 3;
    this.cropScale = cellW / CROP_FRAME_WIDTH;
    this.plants.forEach((spr, slot) => {
      const uv = moundUv(this.spec.soil, slot);
      const p = uvToLocal(uv, texW, texH);
      spr.position.set(p.x, p.y);
      spr.scale.set(this.cropScale);
    });
    this.sparkle.root.position.set((soil.x0 + soil.x1) / 2, (soil.y0 + soil.y1) / 2);
    this.sparkle.setArea((soil.x1 - soil.x0) * 0.36, (soil.y1 - soil.y0) * 0.22);
    this.root.zIndex = 3500;
  }

  sync(player: FarmPlayerCard, accent: (typeof ACCENTS)[number]) {
    this.playerId = player.id;
    this.nameText.text = gardenSignName(player.name);
    this.nameText.style.fill = 0xfff6df;
    this.nameText.style.stroke = { color: Number(accent.border.replace("#", "0x")), width: 6 };
    this.sparkle.setActive(player.plots?.some((p) => p.ready) ?? false);
    const plots = Array.from({ length: PLAYABLE_PLOT_SLOTS }, (_, slot) => player.plots?.find((p) => p.slot === slot));
    this.plants.forEach((spr, slot) => {
      const plot = plots[slot];
      const stage = plot?.growthStage;
      if (!plot || plot.state === "empty" || !stage || !plot.tier) {
        spr.visible = false;
        return;
      }
      spr.texture = cropStageFrame(this.painted.crops, cropKindForTier(plot.tier), stage);
      spr.visible = true;
      spr.scale.set(this.cropScale);
    });
  }

  breathe(t: number) {
    this.plants.forEach((spr, i) => {
      if (!spr.visible) return;
      const s = this.cropScale;
      spr.scale.set(s, s * (1 + Math.sin(t * 1.5 + i) * 0.03));
    });
    this.sparkle.update(t);
  }
}

/** Slim edge HUD — gardens and names live on the painted signs. */
class CardChip {
  readonly root = new Container();
  private frame = new Graphics();
  private nameText: Text;
  private meta: Text;
  private playerId = "";
  private w = 180;
  private h = 58;
  private border = 0x4ea6e6;

  constructor(onOpen: (id: string) => void) {
    this.nameText = new Text({
      text: "",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 16, fill: 0x2a1a0d, fontWeight: "700" },
    });
    this.nameText.anchor.set(0.5, 1);
    this.meta = new Text({
      text: "",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 13, fill: 0x1f74b8, fontWeight: "600" },
    });
    this.meta.anchor.set(0.5, 0);
    this.root.addChild(this.frame, this.nameText, this.meta);
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerdown", () => this.root.scale.set(0.97));
    this.root.on("pointerup", () => {
      this.root.scale.set(1);
      if (this.playerId) onOpen(this.playerId);
    });
    this.root.on("pointerupoutside", () => this.root.scale.set(1));
    this.root.on("pointerover", () => this.root.scale.set(1.04));
    this.root.on("pointerout", () => this.root.scale.set(1));
  }

  layout(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.frame.clear();
    this.frame.roundRect(-w / 2, -h / 2, w, h, 16);
    this.frame.fill({ color: 0xf7fff0, alpha: 0.92 });
    this.frame.stroke({ width: 5, color: this.border });
    this.nameText.position.set(0, -2);
    this.meta.position.set(0, 2);
  }

  sync(player: FarmPlayerCard, accent: (typeof ACCENTS)[number]) {
    this.playerId = player.id;
    this.nameText.text = player.name;
    this.meta.text = `${player.seeds} seeds · ${player.points} pts`;
    this.meta.style.fill = accent.text;
    this.border = Number(accent.border.replace("#", "0x"));
    this.frame.clear();
    this.frame.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 16);
    this.frame.fill({ color: 0xf7fff0, alpha: 0.92 });
    this.frame.stroke({ width: 5, color: this.border });
  }
}
