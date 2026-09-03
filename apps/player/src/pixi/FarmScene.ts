import type { FarmPlayerCard, PublicPlot } from "@farmhand/shared";
import { Container, Graphics, Sprite, Text, Texture, type Application } from "pixi.js";
import { ACCENTS } from "../theme";
import { ANIMAL_KINDS, CROP_KINDS, cropFrame, type Atlas, type CropKind } from "./atlas";
import { YardWanderer } from "./animals";
import { coverFit } from "./draw";
import type { PixiEngine } from "./engine";
import { FxLayer, SparkleField } from "./fx";

function cropKind(tier: number | null | undefined): CropKind {
  return CROP_KINDS[Math.max(0, (tier ?? 1) - 1)] ?? "daisy";
}

function stageOf(plot: PublicPlot | undefined): 1 | 2 | 3 | 4 | 0 {
  if (!plot || plot.state === "empty" || !plot.growthStage) return 0;
  return plot.growthStage;
}

function fitHeight(spr: Sprite, height: number) {
  const th = Math.max(1, spr.texture.height);
  spr.scale.set(height / th);
}

const ANIMAL_STARTS: Array<[number, number]> = [
  [0.28, 0.44],
  [0.36, 0.5],
  [0.42, 0.4],
  [0.5, 0.46],
  [0.33, 0.36],
];

/** Screen-space homestead. Ground is a cover-fit painting — never an iso diamond. */
export class FarmScene {
  readonly root = new Container();
  private fill = new Graphics();
  private ground: Sprite;
  private world = new Container();
  private hud = new Container();
  private fx: FxLayer;
  private animals: YardWanderer[] = [];
  private beds: GardenBed[] = [];
  private cardNodes: CardChip[] = [];
  private store: Sprite;
  private barn: Sprite;
  private truck: Sprite;
  private well: Sprite;
  private props: Sprite[] = [];
  private rails: Sprite[] = [];
  private shadows = new Graphics();
  private pointer = { x: 0.5, y: 0.5 };
  private t = 0;
  private onPlayer: (id: string) => void;
  private onStore: () => void;
  private atlas: Atlas;
  private app: Application;
  private animalPlaced = false;

  constructor(
    engine: PixiEngine,
    atlas: Atlas,
    ground: Texture,
    handlers: { onPlayer: (id: string) => void; onStore: () => void },
  ) {
    this.app = engine.app;
    this.atlas = atlas;
    this.onPlayer = handlers.onPlayer;
    this.onStore = handlers.onStore;
    this.fx = new FxLayer(atlas);

    this.ground = new Sprite(ground);
    this.ground.anchor.set(0, 0);

    this.barn = this.prop("prop_barn", 0.5, 0.92);
    this.store = this.prop("prop_store", 0.5, 0.92);
    this.store.eventMode = "static";
    this.store.cursor = "pointer";
    const storeLabel = new Text({
      text: "Farm Store",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 16,
        fill: 0xfff8ec,
        fontWeight: "700",
        stroke: { color: 0x5c3218, width: 4 },
      },
    });
    storeLabel.anchor.set(0.5, 0);
    storeLabel.position.set(0, 6);
    this.store.addChild(storeLabel);
    this.store.on("pointerover", () => this.store.scale.set(this.store.scale.x * 1.05));
    this.store.on("pointerout", () => this.layout());
    this.store.on("pointerdown", () => this.store.scale.set(this.store.scale.x * 0.96));
    this.store.on("pointerup", () => {
      this.layout();
      this.onStore();
    });
    this.store.on("pointerupoutside", () => this.layout());

    this.truck = this.prop("prop_truck", 0.5, 0.9);
    this.well = this.prop("prop_well", 0.5, 0.92);

    for (const frame of ["prop_hay", "prop_bales_stacked", "prop_crate", "prop_barrel", "prop_bush", "prop_sack"] as const) {
      this.props.push(this.prop(frame, 0.5, 0.9));
    }
    for (let i = 0; i < 7; i++) this.rails.push(this.prop("prop_rail", 0.5, 0.92));

    this.world.sortableChildren = true;
    this.world.addChild(this.shadows, this.barn, this.store, this.truck, this.well, ...this.rails, ...this.props);

    for (let i = 0; i < 3; i++) {
      const bed = new GardenBed(atlas, (id) => this.onPlayer(id));
      this.beds.push(bed);
      this.world.addChild(bed.root);
    }

    ANIMAL_KINDS.forEach((kind, i) => {
      const [nx, ny] = ANIMAL_STARTS[i] ?? [0.35, 0.45];
      const animal = new YardWanderer(atlas, kind, nx * 800, ny * 600, {
        x0: 80,
        y0: 80,
        x1: 400,
        y1: 360,
      });
      this.animals.push(animal);
      this.world.addChild(animal.root);
    });

    this.root.addChild(this.fill, this.ground, this.world, this.hud, this.fx.root);
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.root);

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

  private prop(frame: string, ax: number, ay: number) {
    const spr = new Sprite(this.atlas.frame(frame));
    spr.anchor.set(ax, ay);
    return spr;
  }

  private onMove: (ev: { global: { x: number; y: number } }) => void;
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
    const fit = coverFit(w, h, tex.width || 1536, tex.height || 1024);
    this.ground.scale.set(fit.scale);
    this.ground.position.set(fit.x, fit.y);

    const s = Math.min(w / 1280, h / 800);
    const place = (spr: Sprite, nx: number, ny: number, height: number) => {
      spr.position.set(w * nx, h * ny);
      fitHeight(spr, height);
      spr.zIndex = Math.round(h * ny);
    };

    place(this.barn, 0.16, 0.4, h * 0.4);
    place(this.store, 0.86, 0.28, h * 0.32);
    place(this.truck, 0.56, 0.46, h * 0.22);
    place(this.well, 0.74, 0.2, h * 0.2);

    const railPos: Array<[number, number, number]> = [
      [0.07, 0.34, h * 0.11],
      [0.13, 0.3, h * 0.11],
      [0.2, 0.28, h * 0.11],
      [0.08, 0.5, h * 0.11],
      [0.28, 0.78, h * 0.1],
      [0.48, 0.82, h * 0.1],
      [0.68, 0.78, h * 0.1],
    ];
    this.rails.forEach((rail, i) => {
      const [nx, ny, hh] = railPos[i] ?? [0.1, 0.4, h * 0.1];
      place(rail, nx, ny, hh);
    });

    const propPos: Array<[number, number, number]> = [
      [0.24, 0.52, h * 0.1],
      [0.1, 0.56, h * 0.12],
      [0.62, 0.52, h * 0.08],
      [0.8, 0.42, h * 0.09],
      [0.4, 0.34, h * 0.08],
      [0.22, 0.58, h * 0.08],
    ];
    this.props.forEach((spr, i) => {
      const [nx, ny, hh] = propPos[i] ?? [0.5, 0.5, h * 0.08];
      place(spr, nx, ny, hh);
    });

    this.shadows.clear();
    this.shadows.zIndex = 1;
    for (const [nx, ny, rx, ry] of [
      [0.16, 0.41, 90 * s, 22 * s],
      [0.86, 0.29, 70 * s, 16 * s],
      [0.56, 0.47, 70 * s, 16 * s],
      [0.74, 0.21, 36 * s, 10 * s],
    ] as const) {
      this.shadows.ellipse(w * nx, h * ny, rx, ry);
      this.shadows.fill({ color: 0x1a2410, alpha: 0.26 });
    }

    const bedOrigins: Array<[number, number]> = [
      [0.3, 0.64],
      [0.5, 0.72],
      [0.7, 0.64],
    ];
    this.beds.forEach((bed, i) => {
      const [nx, ny] = bedOrigins[i] ?? [0.5, 0.7];
      bed.root.position.set(w * nx, h * ny);
      bed.root.zIndex = Math.round(h * ny + 8);
      bed.layout(s);
    });

    const paddock = { x0: w * 0.22, y0: h * 0.36, x1: w * 0.5, y1: h * 0.56 };
    this.animals.forEach((a, i) => {
      a.setBounds(paddock);
      if (!this.animalPlaced) {
        const [nx, ny] = ANIMAL_STARTS[i] ?? [0.35, 0.45];
        a.place(w * nx, h * ny);
      }
    });
    this.animalPlaced = true;

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
    const nx = this.pointer.x - 0.5;
    const ny = this.pointer.y - 0.5;
    this.world.x = nx * -10;
    this.world.y = ny * -6;
    this.hud.y = Math.sin(this.t * 0.7) * 2;
    this.animals.forEach((a) => a.update(dt));
    this.beds.forEach((b) => b.breathe(this.t));
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

/** In-world 2×3 garden sitting on the painted ground. */
class GardenBed {
  readonly root = new Container();
  private sign: Sprite;
  private nameText: Text;
  private beds: Graphics[] = [];
  private plants: Sprite[] = [];
  private sparkle: SparkleField;
  private playerId = "";
  private cropScale = 0.42;

  constructor(
    private atlas: Atlas,
    onOpen: (id: string) => void,
  ) {
    this.sign = new Sprite(atlas.frame("prop_sign"));
    this.sign.anchor.set(0.5, 1);
    this.nameText = new Text({
      text: "",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 15, fill: 0x5c3218, fontWeight: "700" },
    });
    this.nameText.anchor.set(0.5, 0.55);
    this.sparkle = new SparkleField(atlas, 10);
    this.sparkle.setArea(70, 40);
    this.root.addChild(this.sparkle.root);
    for (let i = 0; i < 6; i++) {
      const bed = new Graphics();
      const plant = new Sprite();
      plant.anchor.set(0.5, 0.88);
      this.beds.push(bed);
      this.plants.push(plant);
      this.root.addChild(bed, plant);
    }
    this.root.addChild(this.sign, this.nameText);
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

  layout(s: number) {
    const stepX = 44 * s;
    const stepY = 22 * s;
    this.cropScale = (92 * s) / 220;
    this.beds.forEach((bed, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = (col - row) * stepX;
      const y = (col + row) * stepY;
      bed.clear();
      bed.poly([0, 14 * s, 30 * s, 0, 0, -14 * s, -30 * s, 0]);
      bed.fill({ color: 0x6b3a1e });
      bed.stroke({ width: 2, color: 0x3d2010 });
      bed.position.set(x, y);
      this.plants[i].position.set(x, y + 4 * s);
      this.plants[i].scale.set(this.cropScale);
    });
    this.sign.position.set(0, -52 * s);
    this.sign.width = 150 * s;
    this.sign.height = 40 * s;
    this.nameText.position.set(0, -72 * s);
    this.nameText.style.fontSize = Math.max(13, 15 * s);
    this.sparkle.root.position.set(stepX * 0.5, stepY);
    this.sparkle.setArea(72 * s, 36 * s);
  }

  sync(player: FarmPlayerCard, accent: (typeof ACCENTS)[number]) {
    this.playerId = player.id;
    this.nameText.text = `${player.name}'s Garden`;
    this.nameText.style.fill = accent.text;
    let ready = false;
    const plots = Array.from({ length: 6 }, (_, slot) => player.plots?.find((p) => p.slot === slot));
    plots.forEach((plot, i) => {
      const st = stageOf(plot);
      const plant = this.plants[i];
      if (!st) {
        plant.visible = false;
        return;
      }
      plant.visible = true;
      plant.texture = cropFrame(this.atlas, cropKind(plot?.tier), st);
      if (plot?.ready) ready = true;
    });
    this.sparkle.setActive(ready);
  }

  breathe(t: number) {
    this.plants.forEach((plant, i) => {
      if (!plant.visible) return;
      const s = this.cropScale;
      plant.scale.set(s, s * (1 + Math.sin(t * 1.5 + i) * 0.03));
    });
    this.sparkle.update(t);
  }
}

/** Slim edge HUD — the gardens themselves live in the world. */
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

  breathe(_t: number) {
    /* chips stay still so they read as HUD, not floating cards */
  }
}
