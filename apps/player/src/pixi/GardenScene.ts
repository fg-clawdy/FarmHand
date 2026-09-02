import { formatCountdown, type PublicPlot } from "@farmhand/shared";
import { Container, Graphics, Sprite, Text, type Application } from "pixi.js";
import { CROP_KINDS, cropFrame, type Atlas, type CropKind } from "./atlas";
import { AmbientAnimal } from "./animals";
import { BIBLE } from "./draw";
import type { PixiEngine } from "./engine";
import { FxLayer } from "./fx";
import { createGardenMap } from "./tiles";

function cropKind(tier: number | null | undefined): CropKind {
  return CROP_KINDS[Math.max(0, (tier ?? 1) - 1)] ?? "daisy";
}

export class GardenScene {
  readonly root = new Container();
  private world = new Container();
  private plotsLayer = new Container();
  private fx: FxLayer;
  private animals: AmbientAnimal[] = [];
  private slots: PlotNode[] = [];
  private pointer = { x: 0.5, y: 0.5 };
  private t = 0;
  private app: Application;
  private onPlot: (slot: number, empty: boolean) => void;

  constructor(
    engine: PixiEngine,
    atlas: Atlas,
    tileset: import("pixi.js").Texture,
    onPlot: (slot: number, empty: boolean) => void,
  ) {
    this.app = engine.app;
    this.onPlot = onPlot;
    this.fx = new FxLayer(atlas);

    const backdrop = Sprite.from("/art/farm_backdrop.jpg");
    backdrop.anchor.set(0.5, 0.4);
    backdrop.tint = 0xc8d8b8;
    this.world.addChild(backdrop);

    const map = createGardenMap(tileset);
    map.alpha = 0.85;
    this.world.addChild(map);
    this.world.addChild(this.plotsLayer, this.fx.root);
    this.root.addChild(this.world);
    this.app.stage.addChild(this.root);

    for (let i = 0; i < 6; i++) {
      const node = new PlotNode(atlas, i, (slot, empty) => this.onPlot(slot, empty));
      this.slots.push(node);
      this.plotsLayer.addChild(node.root);
    }

    (["chicken", "pig", "duck"] as const).forEach((kind, i) => {
      const a = new AmbientAnimal(atlas, kind, 80 + i * 140, 0, { x: 40, y: 0, w: 900, h: 40 });
      this.animals.push(a);
      this.world.addChild(a.root);
    });

    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointermove", (ev) => {
      this.pointer.x = ev.global.x / this.app.screen.width;
      this.pointer.y = ev.global.y / this.app.screen.height;
    });
    this.layout();
    this.app.renderer.on("resize", () => this.layout());
    this.app.ticker.add((ticker) => this.tick(ticker.deltaMS / 1000));
  }

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
    const bg = this.world.children[0] as Sprite;
    bg.scale.set(Math.max(w / 1600, h / 900) * 1.1);
    bg.position.set(w / 2, h * 0.42);
    const map = this.world.children[1];
    map.position.set(w * 0.5 - 24 * 28, h * 0.28);
    map.scale.set(Math.max(0.7, w / 1400));

    const padX = 28;
    const padY = 18;
    const cellW = (w - padX * 2) / 3;
    const cellH = (h - 88 - padY * 2) / 2;
    this.slots.forEach((slot, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      slot.layout(cellW - 16, cellH - 16);
      slot.root.position.set(padX + col * cellW + cellW / 2, 78 + padY + row * cellH + cellH / 2);
    });
    this.animals.forEach((a, i) => {
      a.root.y = h - 36 - (i % 2) * 10;
    });
  }

  private tick(dt: number) {
    this.t += dt;
    const nx = this.pointer.x - 0.5;
    this.world.x = nx * -12;
    this.animals.forEach((a) => a.update(dt));
    this.slots.forEach((s) => s.breathe(this.t));
    this.fx.update(dt);
  }

  destroy() {
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
  private label: Text;
  private empty = true;
  private ready = false;

  constructor(private atlas: Atlas, slot: number, onOpen: (slot: number, empty: boolean) => void) {
    this.slot = slot;
    this.glow = new Sprite(atlas.frame("fx_glow"));
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.plant.anchor.set(0.5, 0.92);
    this.label = new Text({
      text: "Plant here",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 20, fill: 0xfff8ec, fontWeight: "700" },
    });
    this.label.anchor.set(0.5);
    this.root.addChild(this.bed, this.glow, this.plant, this.label);
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerup", () => onOpen(this.slot, this.empty));
  }

  layout(w: number, h: number) {
    this.bed.clear();
    this.bed.roundRect(-w / 2, -h / 2, w, h, 24);
    this.bed.fill({ color: 0xc8e8ff });
    this.bed.stroke({ width: 8, color: Number(BIBLE.woodDark.replace("#", "0x")) });
    this.bed.ellipse(0, h * 0.28, w * 0.32, 16);
    this.bed.fill({ color: Number(BIBLE.soilDark.replace("#", "0x")) });
    this.plant.position.set(0, h * 0.22);
    this.plant.scale.set(Math.min(w, h) / 220);
    this.glow.position.set(0, 0);
    this.glow.scale.set(Math.min(w, h) / 90);
    this.label.position.set(0, 8);
  }

  sync(plot: PublicPlot | undefined) {
    this.empty = !plot || plot.state === "empty";
    this.ready = !!plot?.ready;
    this.glow.visible = this.ready;
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
    if (this.plant.visible) this.plant.scale.set(this.plant.scale.x, this.plant.scale.x * (1 + Math.sin(t * 1.6 + this.slot) * 0.04));
    if (this.ready) this.glow.alpha = 0.4 + Math.sin(t * 3.2 + this.slot) * 0.22;
  }
}
