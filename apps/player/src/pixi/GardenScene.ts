import { formatCountdown, type PublicPlot } from "@farmhand/shared";
import { Container, Graphics, Sprite, Text, Texture, type Application } from "pixi.js";
import { CROP_KINDS, cropFrame, type Atlas, type CropKind } from "./atlas";
import { YardWanderer } from "./animals";
import { coverFit } from "./draw";
import type { PixiEngine } from "./engine";
import { FxLayer, SparkleField } from "./fx";

function cropKind(tier: number | null | undefined): CropKind {
  return CROP_KINDS[Math.max(0, (tier ?? 1) - 1)] ?? "daisy";
}

function fitHeight(spr: Sprite, height: number) {
  const th = Math.max(1, spr.texture.height);
  spr.scale.set(height / th);
}

const ANIMAL_STARTS: Array<[number, number]> = [
  [0.18, 0.42],
  [0.26, 0.56],
  [0.14, 0.62],
  [0.32, 0.38],
  [0.22, 0.7],
];

const ANIMAL_KINDS = ["chicken", "pig", "sheep", "cow", "horse"] as const;

export class GardenScene {
  readonly root = new Container();
  private fill = new Graphics();
  private ground: Sprite;
  private world = new Container();
  private plotsLayer = new Container();
  private fx: FxLayer;
  private animals: YardWanderer[] = [];
  private slots: PlotNode[] = [];
  private well: Sprite;
  private props: Sprite[] = [];
  private rails: Sprite[] = [];
  private pointer = { x: 0.5, y: 0.5 };
  private t = 0;
  private app: Application;
  private onPlot: (slot: number, empty: boolean) => void;
  private animalPlaced = false;

  constructor(engine: PixiEngine, atlas: Atlas, ground: Texture, onPlot: (slot: number, empty: boolean) => void) {
    this.app = engine.app;
    this.onPlot = onPlot;
    this.fx = new FxLayer(atlas);

    this.ground = new Sprite(ground);
    this.ground.anchor.set(0, 0);

    this.well = new Sprite(atlas.frame("prop_well"));
    this.well.anchor.set(0.5, 0.92);
    for (const frame of ["prop_hay", "prop_crate", "prop_barrel", "prop_bush", "prop_sack"] as const) {
      const spr = new Sprite(atlas.frame(frame));
      spr.anchor.set(0.5, 0.9);
      this.props.push(spr);
    }
    for (let i = 0; i < 5; i++) {
      const rail = new Sprite(atlas.frame("prop_rail"));
      rail.anchor.set(0.5, 0.92);
      this.rails.push(rail);
    }

    this.world.sortableChildren = true;
    this.world.addChild(this.well, ...this.rails, ...this.props, this.plotsLayer, this.fx.root);

    for (let i = 0; i < 6; i++) {
      const node = new PlotNode(atlas, i, (slot, empty) => this.onPlot(slot, empty));
      this.slots.push(node);
      this.plotsLayer.addChild(node.root);
    }

    ANIMAL_KINDS.forEach((kind, i) => {
      const [nx, ny] = ANIMAL_STARTS[i] ?? [0.2, 0.5];
      const a = new YardWanderer(atlas, kind, nx * 800, ny * 600, {
        x0: 40,
        y0: 40,
        x1: 360,
        y1: 520,
      });
      this.animals.push(a);
      this.world.addChild(a.root);
    });

    this.root.addChild(this.fill, this.ground, this.world);
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.root);

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.onMove = (ev: { global: { x: number; y: number } }) => {
      this.pointer.x = ev.global.x / Math.max(1, this.app.screen.width);
      this.pointer.y = ev.global.y / Math.max(1, this.app.screen.height);
    };
    this.app.stage.on("pointermove", this.onMove);
    this.onResize = () => this.layout();
    this.onTick = (ticker: { deltaMS: number }) => this.tick(ticker.deltaMS / 1000);
    this.layout();
    this.app.renderer.on("resize", this.onResize);
    this.app.ticker.add(this.onTick);
  }

  private onMove: (ev: { global: { x: number; y: number } }) => void;
  private onResize: () => void;
  private onTick: (ticker: { deltaMS: number }) => void;

  setPlots(plots: PublicPlot[]) {
    this.slots.forEach((slot) => {
      const plot = plots.find((p) => p.slot === slot.slot);
      slot.sync(plot);
    });
  }

  fxWater(slot: number) {
    const n = this.slots[slot];
    if (n) this.fx.burst(n.root.x, n.root.y - 20, "water");
  }
  fxFertilizer(slot: number) {
    const n = this.slots[slot];
    if (n) this.fx.burst(n.root.x, n.root.y - 20, "fert");
  }
  fxHarvest(slot: number) {
    const n = this.slots[slot];
    if (n) this.fx.burst(n.root.x, n.root.y - 20, "harvest");
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

    place(this.well, 0.82, 0.22, h * 0.2);
    const railPos: Array<[number, number, number]> = [
      [0.42, 0.34, h * 0.1],
      [0.52, 0.3, h * 0.1],
      [0.38, 0.78, h * 0.1],
      [0.58, 0.8, h * 0.1],
      [0.78, 0.76, h * 0.1],
    ];
    this.rails.forEach((rail, i) => {
      const [nx, ny, hh] = railPos[i] ?? [0.5, 0.5, h * 0.1];
      place(rail, nx, ny, hh);
    });
    const propPos: Array<[number, number, number]> = [
      [0.12, 0.32, h * 0.1],
      [0.88, 0.4, h * 0.08],
      [0.16, 0.78, h * 0.09],
      [0.34, 0.26, h * 0.08],
      [0.9, 0.68, h * 0.08],
    ];
    this.props.forEach((spr, i) => {
      const [nx, ny, hh] = propPos[i] ?? [0.5, 0.5, h * 0.08];
      place(spr, nx, ny, hh);
    });

    // Six plots on the painted tilled patch (center-right of the garden ground).
    const originX = w * 0.58;
    const originY = h * 0.52;
    const stepX = 78 * s;
    const stepY = 40 * s;
    this.slots.forEach((slot, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = originX + (col - row) * stepX;
      const y = originY + (col + row) * stepY;
      slot.root.position.set(x, y);
      slot.root.zIndex = Math.round(y + 20);
      slot.layout(s);
    });
    this.plotsLayer.zIndex = Math.round(originY + 20);

    const paddock = { x0: w * 0.1, y0: h * 0.34, x1: w * 0.38, y1: h * 0.74 };
    this.animals.forEach((a, i) => {
      a.setBounds(paddock);
      if (!this.animalPlaced) {
        const [nx, ny] = ANIMAL_STARTS[i] ?? [0.2, 0.5];
        a.place(w * nx, h * ny);
      }
    });
    this.animalPlaced = true;
  }

  private tick(dt: number) {
    this.t += dt;
    const nx = this.pointer.x - 0.5;
    this.world.x = nx * -8;
    this.animals.forEach((a) => a.update(dt));
    this.slots.forEach((s) => s.breathe(this.t));
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

class PlotNode {
  readonly root = new Container();
  readonly slot: number;
  private bed = new Graphics();
  private plant = new Sprite();
  private glow: Sprite;
  private sparkle: SparkleField;
  private label: Text;
  private empty = true;
  private ready = false;
  private cropScale = 0.7;

  constructor(private atlas: Atlas, slot: number, onOpen: (slot: number, empty: boolean) => void) {
    this.slot = slot;
    this.glow = new Sprite(atlas.frame("fx_glow"));
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.sparkle = new SparkleField(atlas, 8);
    this.plant.anchor.set(0.5, 0.88);
    this.label = new Text({
      text: "Plant here",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 15, fill: 0xfff8ec, fontWeight: "700", stroke: { color: 0x3d2010, width: 4 } },
    });
    this.label.anchor.set(0.5);
    this.root.addChild(this.bed, this.glow, this.sparkle.root, this.plant, this.label);
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerup", () => onOpen(this.slot, this.empty));
  }

  layout(s: number) {
    this.cropScale = (150 * s) / 220;
    this.bed.clear();
    this.bed.poly([0, 22 * s, 48 * s, 0, 0, -22 * s, -48 * s, 0]);
    this.bed.fill({ color: 0x6b3a1e, alpha: 0.55 });
    this.bed.stroke({ width: 2, color: 0x3d2010, alpha: 0.7 });
    this.plant.position.set(0, 6 * s);
    this.plant.scale.set(this.cropScale);
    this.glow.position.set(0, -12 * s);
    this.glow.scale.set(1.8 * s);
    this.sparkle.root.position.set(0, -8 * s);
    this.sparkle.setArea(40 * s, 28 * s);
    this.label.position.set(0, 34 * s);
    this.label.style.fontSize = Math.max(13, 15 * s);
  }

  sync(plot: PublicPlot | undefined) {
    this.empty = !plot || plot.state === "empty";
    this.ready = !!plot?.ready;
    this.glow.visible = this.ready;
    this.sparkle.setActive(this.ready);
    if (this.empty || !plot?.growthStage || !plot.tier) {
      this.plant.visible = false;
      this.label.text = "Plant here";
      this.label.visible = true;
      return;
    }
    this.plant.texture = cropFrame(this.atlas, cropKind(plot.tier), plot.growthStage);
    this.plant.visible = true;
    this.label.visible = true;
    this.label.text = plot.ready ? "READY" : formatCountdown(plot.remainingMs);
  }

  breathe(t: number) {
    if (this.plant.visible) {
      const s = this.cropScale;
      this.plant.scale.set(s, s * (1 + Math.sin(t * 1.6 + this.slot) * 0.04));
    }
    if (this.ready) this.glow.alpha = 0.4 + Math.sin(t * 3.2 + this.slot) * 0.22;
    this.sparkle.update(t);
  }
}
