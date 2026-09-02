import { formatCountdown, type PublicPlot } from "@farmhand/shared";
import { Container, Graphics, Sprite, Text, type Application } from "pixi.js";
import { CROP_KINDS, cropFrame, type Atlas, type CropKind } from "./atlas";
import { AmbientAnimal } from "./animals";
import type { PixiEngine } from "./engine";
import { createFenceRing } from "./fence";
import { FxLayer } from "./fx";
import { isoGround } from "./iso";
import { createGardenMap, GARDEN_FENCE, GARDEN_PLOTS } from "./tiles";

function cropKind(tier: number | null | undefined): CropKind {
  return CROP_KINDS[Math.max(0, (tier ?? 1) - 1)] ?? "daisy";
}

export class GardenScene {
  readonly root = new Container();
  private world = new Container();
  private plotsLayer = new Container();
  private sky = new Graphics();
  private fx: FxLayer;
  private animals: AmbientAnimal[] = [];
  private slots: PlotNode[] = [];
  private pointer = { x: 0.5, y: 0.5 };
  private t = 0;
  private app: Application;
  private onPlot: (slot: number, empty: boolean) => void;
  private origin = { x: 0, y: 0 };
  private mapScale = 1;

  constructor(
    engine: PixiEngine,
    atlas: Atlas,
    tileset: import("pixi.js").Texture,
    onPlot: (slot: number, empty: boolean) => void,
  ) {
    this.app = engine.app;
    this.onPlot = onPlot;
    this.fx = new FxLayer(atlas);

    this.world.addChild(this.sky);
    const map = createGardenMap(tileset);
    this.world.addChild(map);
    this.world.addChild(createFenceRing(atlas, GARDEN_FENCE));
    this.world.addChild(this.plotsLayer, this.fx.root);
    this.world.sortableChildren = true;
    this.root.addChild(this.world);
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.root);

    for (let i = 0; i < 6; i++) {
      const node = new PlotNode(atlas, i, (slot, empty) => this.onPlot(slot, empty));
      this.slots.push(node);
      this.plotsLayer.addChild(node.root);
    }

    (["chicken", "pig", "duck"] as const).forEach((kind, i) => {
      const a = new AmbientAnimal(atlas, kind, 2 + i * 2, 6, { c0: 1, r0: 5, c1: 8, r1: 6 });
      this.animals.push(a);
      this.world.addChild(a.root);
    });

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
    this.sky.clear();
    this.sky.rect(-w, -h, w * 3, h * 3);
    this.sky.fill({ color: 0x7ec8f0 });
    this.sky.rect(-w, h * 0.35, w * 3, h * 2);
    this.sky.fill({ color: 0x5fbe4a });
    this.sky.ellipse(w * 0.7, 40, 48, 48);
    this.sky.fill({ color: 0xffe56a });

    this.mapScale = Math.max(0.78, Math.min(w / 1000, h / 640));
    this.origin = { x: w * 0.5, y: h * 0.22 };
    this.world.position.set(this.origin.x, this.origin.y);
    this.world.scale.set(this.mapScale);

    this.slots.forEach((slot, i) => {
      const [col, row] = GARDEN_PLOTS[i];
      const p = isoGround(col, row);
      slot.root.position.set(p.x, p.y);
      slot.root.zIndex = col + row + 10;
      slot.layout(120, 90);
    });
    this.animals.forEach((a) => a.setOrigin(0, 0));
  }

  private tick(dt: number) {
    this.t += dt;
    const nx = this.pointer.x - 0.5;
    this.world.x = this.origin.x + nx * -16;
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
  private label: Text;
  private empty = true;
  private ready = false;

  constructor(private atlas: Atlas, slot: number, onOpen: (slot: number, empty: boolean) => void) {
    this.slot = slot;
    this.glow = new Sprite(atlas.frame("fx_glow"));
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.plant.anchor.set(0.5, 0.88);
    this.label = new Text({
      text: "Plant here",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 16, fill: 0xfff8ec, fontWeight: "700" },
    });
    this.label.anchor.set(0.5);
    this.root.addChild(this.bed, this.glow, this.plant, this.label);
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerup", () => onOpen(this.slot, this.empty));
  }

  layout(_w: number, _h: number) {
    this.bed.clear();
    this.bed.poly([0, 28, 58, 0, 0, -28, -58, 0]);
    this.bed.fill({ color: 0x000000, alpha: 0.001 });
    this.plant.position.set(0, 8);
    this.plant.scale.set(0.85);
    this.glow.position.set(0, -10);
    this.glow.scale.set(1.6);
    this.label.position.set(0, 36);
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
    if (this.plant.visible) {
      const s = 0.85;
      this.plant.scale.set(s, s * (1 + Math.sin(t * 1.6 + this.slot) * 0.04));
    }
    if (this.ready) this.glow.alpha = 0.4 + Math.sin(t * 3.2 + this.slot) * 0.22;
  }
}
