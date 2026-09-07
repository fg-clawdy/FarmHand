import { cropKindForTier, formatCountdown, PLOTS_PER_GARDEN, type PublicPlot } from "@farmhand/shared";
import { Container, Ellipse, Graphics, Sprite, Text, type Application } from "pixi.js";
import type { Atlas } from "./atlas";
import { coverFit } from "./draw";
import type { PixiEngine } from "./engine";
import { FxLayer, SparkleField } from "./fx";
import {
  GARDEN_ZOOM_LAYOUT,
  GARDEN_ZOOM_TEXTURE,
  gardenMoundUv,
} from "./gardenLayout";
import { CROP_FRAME_WIDTH, cropStageFrame, type PaintedArt } from "./paintedAssets";
import { uvToLocal } from "./playfieldLayout";

/**
 * Zoomed garden: painted 3×3 mounds, crop sprites, tool glow. No animals, no extra props.
 */
export class GardenScene {
  readonly root = new Container();
  private fill = new Graphics();
  private playfield = new Container();
  private ground: Sprite;
  private nameText: Text;
  private fx: FxLayer;
  private slots: PlotNode[] = [];
  private t = 0;
  private app: Application;
  private onPlot: (slot: number) => void;

  constructor(
    engine: PixiEngine,
    atlas: Atlas,
    painted: PaintedArt,
    onPlot: (slot: number) => void,
  ) {
    this.app = engine.app;
    this.onPlot = onPlot;
    this.fx = new FxLayer(atlas);

    this.ground = new Sprite(painted.gardenZoom);
    this.ground.anchor.set(0, 0);
    this.playfield.sortableChildren = true;
    this.playfield.addChild(this.ground);

    const tw = painted.gardenZoom.width || GARDEN_ZOOM_TEXTURE.width;
    const th = painted.gardenZoom.height || GARDEN_ZOOM_TEXTURE.height;

    this.nameText = new Text({
      text: "",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 42,
        fill: 0xfff6df,
        fontWeight: "700",
        stroke: { color: 0x2a1608, width: 5 },
        align: "center",
      },
    });
    this.nameText.anchor.set(0.5, 0.5);
    const sign = uvToLocal(GARDEN_ZOOM_LAYOUT.sign, tw, th);
    this.nameText.position.set(sign.x, sign.y);
    this.nameText.zIndex = 2000;
    this.playfield.addChild(this.nameText);

    for (let i = 0; i < PLOTS_PER_GARDEN; i++) {
      const node = new PlotNode(atlas, painted, i, (slot) => this.onPlot(slot));
      const uv = gardenMoundUv(i);
      const p = uvToLocal(uv, tw, th);
      node.root.position.set(p.x, p.y);
      node.root.zIndex = Math.round(p.y);
      this.slots.push(node);
      this.playfield.addChild(node.root);
    }
    this.fx.root.zIndex = 5000;
    this.playfield.addChild(this.fx.root);

    this.root.addChild(this.fill, this.playfield);
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.root);

    this.layout();
    this.onResize = () => this.layout();
    this.onTick = (ticker: { deltaMS: number }) => this.tick(ticker.deltaMS / 1000);
    this.app.renderer.on("resize", this.onResize);
    this.app.ticker.add(this.onTick);
  }

  private onResize: () => void;
  private onTick: (ticker: { deltaMS: number }) => void;

  setName(name: string) {
    this.nameText.text = name.trim() || "Garden";
  }

  setPlots(plots: PublicPlot[]) {
    this.slots.forEach((slot) => {
      const plot = plots.find((p) => p.slot === slot.slot);
      slot.sync(plot);
    });
  }

  setGlow(slots: readonly number[]) {
    const active = new Set(slots);
    this.slots.forEach((node) => node.setToolGlow(active.has(node.slot)));
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
    const tw = tex.width || GARDEN_ZOOM_TEXTURE.width;
    const th = tex.height || GARDEN_ZOOM_TEXTURE.height;
    const fit = coverFit(w, h, tw, th);
    this.playfield.scale.set(fit.scale);
    this.playfield.position.set(fit.x, fit.y);

    const s = tw / GARDEN_ZOOM_TEXTURE.width;
    this.slots.forEach((slot) => slot.layout(s));
    this.nameText.style.fontSize = Math.max(32, 48 * s);
  }

  private tick(dt: number) {
    this.t += dt;
    this.slots.forEach((s) => s.breathe(this.t));
  }

  destroy() {
    this.app.ticker.remove(this.onTick);
    this.app.renderer.off("resize", this.onResize);
    this.root.removeFromParent();
    this.root.destroy({ children: true });
  }
}

class PlotNode {
  readonly root = new Container();
  readonly slot: number;
  private plant = new Sprite();
  private glow: Sprite;
  private sparkle: SparkleField;
  private label: Text;
  private toolGlow = false;
  private ready = false;
  private cropScale = 0.4;

  constructor(
    atlas: Atlas,
    private painted: PaintedArt,
    slot: number,
    onOpen: (slot: number) => void,
  ) {
    this.slot = slot;
    this.glow = new Sprite(atlas.frame("fx_glow"));
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.glow.visible = false;
    this.sparkle = new SparkleField(atlas, 8);
    this.plant.anchor.set(0.5, 0.9);
    this.label = new Text({
      text: "",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 18,
        fill: 0xfff8ec,
        fontWeight: "700",
        stroke: { color: 0x3d2010, width: 4 },
      },
    });
    this.label.anchor.set(0.5, 0);
    this.root.addChild(this.glow, this.sparkle.root, this.plant, this.label);
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerup", () => onOpen(this.slot));
  }

  layout(s: number) {
    const { rx, ry } = GARDEN_ZOOM_LAYOUT.hit;
    this.cropScale = (148 * s) / CROP_FRAME_WIDTH;
    this.plant.scale.set(this.cropScale);
    this.glow.position.set(0, -10 * s);
    this.glow.scale.set(2.4 * s);
    this.sparkle.root.position.set(0, -8 * s);
    this.sparkle.setArea(rx * s * 0.7, ry * s * 0.7);
    this.label.position.set(0, 28 * s);
    this.label.style.fontSize = Math.max(14, 18 * s);
    this.root.hitArea = new Ellipse(0, 0, rx * s, ry * s);
  }

  setToolGlow(on: boolean) {
    this.toolGlow = on;
    this.glow.visible = on;
  }

  sync(plot: PublicPlot | undefined) {
    const empty = !plot || plot.state === "empty";
    this.ready = !!plot?.ready;
    this.glow.visible = this.toolGlow;
    this.sparkle.setActive(this.ready);
    if (empty || !plot?.growthStage || !plot.tier) {
      this.plant.visible = false;
      this.label.visible = false;
      return;
    }
    this.plant.texture = cropStageFrame(this.painted.crops, cropKindForTier(plot.tier), plot.growthStage);
    this.plant.visible = true;
    this.label.visible = true;
    this.label.text = plot.ready ? "READY" : formatCountdown(plot.remainingMs);
  }

  breathe(t: number) {
    if (this.plant.visible) {
      const s = this.cropScale;
      this.plant.scale.set(s, s * (1 + Math.sin(t * 1.6 + this.slot) * 0.04));
    }
    if (this.toolGlow) this.glow.alpha = 0.55 + Math.sin(t * 3.4 + this.slot) * 0.28;
    this.sparkle.update(t);
  }
}
