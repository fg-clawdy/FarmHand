import { cropKindForTier, formatCountdown, PLOTS_PER_GARDEN, type CropKind, type PublicPlot } from "@farmhand/shared";
import { Container, Ellipse, Graphics, Sprite, Text, type Application } from "pixi.js";
import type { Atlas } from "./atlas";
import type { PixiEngine } from "./engine";
import { FxLayer, SparkleField } from "./fx";
import {
  GARDEN_BASKET_LAYOUT,
  GARDEN_CROP_SEAT,
  GARDEN_ZOOM_LAYOUT,
  GARDEN_ZOOM_TEXTURE,
  gardenMoundLocal,
  gardenMoundWorld,
  gardenPlayfieldFit,
} from "./gardenLayout";
import {
  ZOOM_MOUND_COVER_PX,
  cropCoverScale,
  cropDiscAnchor,
  cropPickedFrame,
  cropStageFrame,
  type PaintedArt,
} from "./paintedAssets";
import { uvToLocal } from "./playfieldLayout";
import { SignAvatarBadge, gardenZoomBadgeLocal } from "./signAvatar";

/**
 * Zoomed garden: painted 3×3 mounds, crop sprites, tool glow. No animals, no extra props.
 * Dirt and crops share `playfield`; resize/orientation only cameraFits that container.
 */
export class GardenScene {
  readonly root = new Container();
  private fill = new Graphics();
  private playfield = new Container();
  private ground: Sprite;
  private nameText: Text;
  private fx: FxLayer;
  private slots: PlotNode[] = [];
  private floaters: { text: Text; life: number; max: number; vy: number }[] = [];
  private picks: HarvestPick[] = [];
  private basket: HarvestBasket;
  private t = 0;
  private app: Application;
  private onPlot: (slot: number) => void;
  private onAvatar: () => void;
  private onBasket: () => void;
  private avatarBadge: SignAvatarBadge;

  constructor(
    engine: PixiEngine,
    atlas: Atlas,
    painted: PaintedArt,
    onPlot: (slot: number) => void,
    onAvatar?: () => void,
    onBasket?: () => void,
  ) {
    this.app = engine.app;
    this.onPlot = onPlot;
    this.onAvatar = onAvatar ?? (() => undefined);
    this.onBasket = onBasket ?? (() => undefined);
    this.fx = new FxLayer(atlas);

    this.ground = new Sprite(painted.gardenZoom);
    this.ground.anchor.set(0, 0);
    this.ground.zIndex = 0;
    const tw = GARDEN_ZOOM_TEXTURE.width;
    const th = GARDEN_ZOOM_TEXTURE.height;
    this.ground.width = tw;
    this.ground.height = th;
    this.playfield.sortableChildren = true;
    this.playfield.addChild(this.ground);

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
    this.avatarBadge = new SignAvatarBadge(() => this.onAvatar());
    this.placeAvatarBadge(tw, th);
    this.playfield.addChild(this.avatarBadge.root);

    for (let i = 0; i < PLOTS_PER_GARDEN; i++) {
      const node = new PlotNode(atlas, painted, i, (slot) => this.onPlot(slot));
      const p = gardenMoundLocal(i);
      node.root.position.set(p.x, p.y);
      node.root.zIndex = Math.round(p.y);
      this.slots.push(node);
      this.playfield.addChild(node.root);
    }
    this.fx.root.zIndex = 5000;
    this.playfield.addChild(this.fx.root);

    this.basket = new HarvestBasket(painted, () => this.onBasket());
    this.playfield.addChild(this.basket.root);

    this.root.addChild(this.fill, this.playfield);
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.root);
    exposeGardenDebug(this);

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

  setAvatar(player: {
    id: string;
    name: string;
    mascot: import("@farmhand/shared").Mascot;
    avatarKind?: string | null;
    avatarPreset?: string | null;
    avatarUrl?: string | null;
  }) {
    this.avatarBadge.sync(player);
  }

  private placeAvatarBadge(tw: number, th: number) {
    const sign = uvToLocal(GARDEN_ZOOM_LAYOUT.sign, tw, th);
    const radius = Math.max(22, 36 * (th / GARDEN_ZOOM_TEXTURE.height));
    const badge = gardenZoomBadgeLocal(sign, radius);
    this.avatarBadge.place(badge.x, badge.y, badge.radius);
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

  /** QA only (`/qa/garden?markers=1`). Default off — never drawn in live garden play. */
  setMoundMarkers(on: boolean) {
    this.slots.forEach((node) => node.setMoundMarker(on));
  }

  fxWater(slot: number) {
    const n = this.slots[slot];
    if (n) this.fx.burst(n.root.x, n.root.y - 20, "water");
  }
  fxFertilizer(slot: number) {
    const n = this.slots[slot];
    if (n) this.fx.burst(n.root.x, n.root.y - 20, "fert");
  }
  fxHarvest(slot: number, reward?: { points: number; seedsFromShards: number; kind?: string; basketItemId?: string }) {
    const n = this.slots[slot];
    if (!n) return;
    const kind = (reward?.kind && isCropKind(reward.kind) ? reward.kind : n.cropKind()) ?? "corn";
    n.beginPick();
    const from = { x: n.root.x, y: n.root.y - 36 };
    const pickTex = cropPickedFrame(n.paintedCrops(), kind);
    if (!pickTex?.source) {
      if (reward && reward.points > 0) this.floatPoints(from.x, from.y - 20, reward.points);
      return;
    }
    const sprite = new Sprite(pickTex);
    sprite.anchor.set(0.5, 1);
    const plantScale = Math.max(0.18, n.cropScaleValue() * 0.92);
    sprite.scale.set(plantScale);
    sprite.position.set(from.x, from.y);
    sprite.zIndex = 7000;
    this.playfield.addChild(sprite);
    const dest = this.basket.reserveSlot(reward?.basketItemId, kind);
    this.picks.push({
      sprite,
      from,
      hop: { x: from.x, y: from.y - 92 },
      to: dest,
      life: 0.86,
      max: 0.86,
      scale: plantScale,
      kind,
      itemId: reward?.basketItemId,
    });
    if (reward && reward.points > 0) this.floatPoints(from.x, from.y - 20, reward.points);
  }

  /** Draw held produce. Items still flying are reserved and not drawn twice. */
  setBasket(items: BasketView[]) {
    const flying = new Set(this.picks.map((p) => p.itemId).filter((id): id is string => !!id));
    this.basket.sync(items, flying);
  }

  /** Screen position of the points meter is not in the playfield; stars launch from the basket. */
  basketLaunchLocal() {
    return this.basket.mouth();
  }

  private floatPoints(x: number, y: number, points: number) {
    const text = new Text({
      text: `+ ${points} points`,
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 40,
        fill: 0xffe56a,
        fontWeight: "900",
        stroke: { color: 0x2a1608, width: 7 },
        align: "center",
      },
    });
    text.anchor.set(0.5, 1);
    text.position.set(x, y);
    text.zIndex = 8000;
    this.playfield.addChild(text);
    this.floaters.push({ text, life: 1.6, max: 1.6, vy: -54 });
  }

  relayout() {
    this.layout();
  }

  private layout() {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    this.fill.clear();
    this.fill.rect(0, 0, w, h);
    this.fill.fill({ color: 0x3d8a32 });

    const tw = GARDEN_ZOOM_TEXTURE.width;
    const th = GARDEN_ZOOM_TEXTURE.height;
    this.ground.width = tw;
    this.ground.height = th;
    // One transform for dirt + crops. Plot locals stay texture pixels.
    const fit = gardenPlayfieldFit(w, h);
    this.playfield.scale.set(fit.scale);
    this.playfield.position.set(fit.x, fit.y);

    this.slots.forEach((slot) => {
      const p = gardenMoundLocal(slot.slot);
      slot.root.position.set(p.x, p.y);
      slot.root.zIndex = Math.round(p.y);
      slot.layout(1);
    });
    this.basket.place(tw, th);
    const sign = uvToLocal(GARDEN_ZOOM_LAYOUT.sign, tw, th);
    this.nameText.position.set(sign.x, sign.y);
    this.nameText.style.fontSize = Math.max(32, 48);
  }

  private tick(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    this.slots.forEach((s) => s.breathe(this.t, dt));
    this.basket.update(dt);
    this.tickPicks(dt);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i]!;
      f.life -= dt;
      f.text.y += f.vy * dt;
      f.text.alpha = Math.max(0, f.life / f.max);
      f.text.scale.set(1 + (1 - f.life / f.max) * 0.18);
      if (f.life <= 0) {
        f.text.destroy();
        this.floaters.splice(i, 1);
      }
    }
  }

  private tickPicks(dt: number) {
    for (let i = this.picks.length - 1; i >= 0; i--) {
      const pick = this.picks[i]!;
      pick.life -= dt;
      const k = 1 - Math.max(0, pick.life / pick.max);
      const pos = pickCurve(pick.from, pick.hop, pick.to, k);
      pick.sprite.position.set(pos.x, pos.y);
      pick.sprite.rotation = Math.sin(k * Math.PI) * 0.18;
      const landed = 0.18;
      const settle = pick.scale + (landed - pick.scale) * smooth(k);
      pick.sprite.scale.set(settle);
      pick.sprite.zIndex = 7000 + Math.round(pos.y);
      if (k >= 1) {
        pick.sprite.destroy();
        this.picks.splice(i, 1);
        this.basket.release(pick.itemId);
      }
    }
  }

  destroy() {
    this.app.ticker.remove(this.onTick);
    this.app.renderer.off("resize", this.onResize);
    if (gardenDebugOwner === this) {
      gardenDebugOwner = null;
      const w = globalThis as { __farmhandGardenDebug?: unknown; __farmhandGardenCanvas?: unknown };
      if (w.__farmhandGardenDebug) delete w.__farmhandGardenDebug;
      if (w.__farmhandGardenCanvas) delete w.__farmhandGardenCanvas;
    }
    this.root.removeFromParent();
    this.root.destroy({ children: true, texture: false, textureSource: false });
  }

  /** Live QA: one sprite per plot, frame rect, anchor, scale, world vs mound UV. */
  debugPlants() {
    const tw = GARDEN_ZOOM_TEXTURE.width;
    const th = GARDEN_ZOOM_TEXTURE.height;
    const fit = gardenPlayfieldFit(this.app.screen.width, this.app.screen.height);
    return this.slots.map((slot) => {
      const world = gardenMoundWorld(slot.slot, this.app.screen.width, this.app.screen.height);
      const local = world.local;
      const uv = { u: local.x / tw, v: local.y / th };
      const expected = { x: world.x, y: world.y };
      const row = slot.debug();
      const ground = { w: this.ground.width, h: this.ground.height, tw, th };
      const view = { w: this.app.screen.width, h: this.app.screen.height };
      return {
        ...row,
        uv,
        local,
        expected,
        uvDx: row.mound.x - expected.x,
        uvDy: row.mound.y - expected.y,
        fit,
        view,
        playfieldDrift: {
          scale: this.playfield.scale.x - fit.scale,
          x: this.playfield.position.x - fit.x,
          y: this.playfield.position.y - fit.y,
        },
        ground,
      };
    });
  }
}

let gardenDebugOwner: GardenScene | null = null;

function exposeGardenDebug(scene: GardenScene) {
  // Window hooks are QA-only. Normal `/garden/:id` play must not grow debug globals.
  if (typeof location === "undefined" || !location.pathname.startsWith("/qa/")) return;
  gardenDebugOwner = scene;
  const w = globalThis as {
    __farmhandGardenDebug?: () => ReturnType<GardenScene["debugPlants"]>;
    __farmhandGardenCanvas?: () => HTMLCanvasElement | OffscreenCanvas | undefined;
  };
  w.__farmhandGardenDebug = () => scene.debugPlants();
  w.__farmhandGardenCanvas = () => scene["app"]?.canvas;
}

class PlotNode {
  readonly root = new Container();
  readonly slot: number;
  private plant = new Sprite();
  private shadow: Graphics;
  private marker: Graphics;
  private glow: Sprite;
  private approvalAura = new Graphics();
  private sparkle: SparkleField;
  private label: Text;
  private toolGlow = false;
  private showMarker = false;
  private ready = false;
  private cropScale = 0.4;
  private texScale = 1;
  private celebrateT = -1;
  private kind: CropKind | null = null;

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
    this.approvalAura.clear();
    this.approvalAura.ellipse(0, 10, 58, 30);
    this.approvalAura.fill({ color: 0xb57bff, alpha: 0.25 });
    this.approvalAura.ellipse(0, 10, 42, 22);
    this.approvalAura.fill({ color: 0xd8b4ff, alpha: 0.2 });
    this.approvalAura.visible = false;

    this.sparkle = new SparkleField(atlas, 8);
    this.plant.anchor.set(0.5, 0.88);
    this.shadow = new Graphics();
    this.shadow.visible = false;
    this.marker = new Graphics();
    this.marker.visible = false;
    this.marker.eventMode = "none";
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
    this.root.addChild(this.glow, this.approvalAura, this.shadow, this.sparkle.root, this.plant, this.label, this.marker);
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.plant.mask = null;
    // Require down+up on the same plot so a stray pointerup cannot open the picker.
    let pressed = false;
    this.root.on("pointerdown", (ev) => {
      pressed = true;
      ev.stopPropagation();
    });
    this.root.on("pointerup", (ev) => {
      if (!pressed) return;
      pressed = false;
      ev.stopPropagation();
      onOpen(this.slot);
    });
    this.root.on("pointerupoutside", () => {
      pressed = false;
    });
    this.root.on("pointercancel", () => {
      pressed = false;
    });
  }

  layout(s: number) {
    this.texScale = s;
    const { rx, ry } = GARDEN_ZOOM_LAYOUT.hit;
    const cover = ZOOM_MOUND_COVER_PX * s;
    this.plant.position.set(GARDEN_CROP_SEAT.x, GARDEN_CROP_SEAT.y);
    this.shadow.clear();
    this.shadow.ellipse(0, cover * 0.08, cover * 0.52, cover * 0.34);
    this.shadow.fill({ color: 0x2a1608, alpha: 0.28 });
    this.glow.position.set(0, -cover * 0.22);
    this.glow.scale.set(2.2 * s);
    this.sparkle.root.position.set(0, -cover * 0.28);
    this.sparkle.setArea(rx * s * 0.7, ry * s * 0.7);
    this.label.position.set(0, cover * 0.34);
    this.label.style.fontSize = Math.max(14, 18 * s);
    this.root.hitArea = new Ellipse(0, 0, rx * s, ry * s);
    this.drawMoundMarker();
  }

  setMoundMarker(on: boolean) {
    this.showMarker = on;
    this.drawMoundMarker();
  }

  private drawMoundMarker() {
    this.marker.clear();
    this.marker.visible = this.showMarker;
    if (!this.showMarker) return;
    this.marker.circle(0, 0, 9);
    this.marker.fill({ color: 0xffffff });
    this.marker.circle(0, 0, 9);
    this.marker.stroke({ width: 3, color: 0x1a1008 });
    this.marker.moveTo(-18, 0);
    this.marker.lineTo(18, 0);
    this.marker.moveTo(0, -18);
    this.marker.lineTo(0, 18);
    this.marker.stroke({ width: 3, color: 0xe10600 });
  }

  setToolGlow(on: boolean) {
    this.toolGlow = on;
    this.glow.visible = on;
  }

  sync(plot: PublicPlot | undefined) {
    const empty = !plot || plot.state === "empty";
    this.ready = !!plot?.ready;
    this.glow.visible = this.toolGlow;
    if (this.celebrateT >= 0) {
      this.sparkle.setActive(false);
      this.label.visible = false;
      this.plant.visible = false;
      this.shadow.visible = false;
      return;
    }
    this.sparkle.setActive(this.ready);
    if (empty || !plot.growthStage || !plot.tier) {
      this.plant.visible = false;
      this.shadow.visible = false;
      this.label.visible = false;
      return;
    }
    const kind = cropKindForTier(plot.tier);
    this.kind = kind;
    this.plant.texture = cropStageFrame(this.painted.crops, kind, plot.growthStage);
    const pivot = cropDiscAnchor(kind, plot.growthStage);
    this.plant.anchor.set(pivot.x, pivot.y);
    this.cropScale = cropCoverScale(kind, plot.growthStage, ZOOM_MOUND_COVER_PX * this.texScale);
    this.plant.scale.set(this.cropScale);
    this.plant.visible = true;
    this.shadow.visible = true;
    this.label.visible = true;
    const wilted = plot.state === "wilted" || plot.greyed;
    const awaiting = Boolean(plot.awaitingApproval) || plot.state === "purgatory";
    this.plant.tint = wilted ? 0x8a8a8a : awaiting ? 0xe8d7ff : 0xffffff;
    this.plant.alpha = wilted ? 0.72 : 1;
    this.approvalAura.visible = awaiting && !wilted;
    if (wilted) this.label.text = "WILTED";
    else if (awaiting && plot.ready) this.label.text = "WAITING";
    else if (plot.ready) this.label.text = "READY";
    else this.label.text = formatCountdown(plot.remainingMs);
    this.plant.mask = null;
  }

  beginPick() {
    this.celebrateT = 0.01;
    this.plant.visible = false;
    this.plant.alpha = 1;
    this.plant.rotation = 0;
    this.shadow.visible = false;
    this.label.visible = false;
    this.sparkle.setActive(false);
  }

  cropKind() {
    return this.kind;
  }

  paintedCrops() {
    return this.painted.crops;
  }

  cropScaleValue() {
    return this.cropScale;
  }

  breathe(t: number, dt = 1 / 60) {
    if (this.celebrateT >= 0) {
      this.celebrateT += dt;
      this.plant.visible = false;
      this.shadow.visible = false;
      if (this.celebrateT >= 1.2) this.celebrateT = -1;
      return;
    }
    if (this.plant.visible) {
      const s = this.cropScale;
      this.plant.scale.set(s, s * (1 + Math.sin(t * 1.6 + this.slot) * 0.012));
    }
    if (this.toolGlow) this.glow.alpha = 0.55 + Math.sin(t * 3.4 + this.slot) * 0.28;
    this.sparkle.update(t);
  }

  debug() {
    const frame = this.plant.texture.frame;
    const orig = this.plant.texture.orig;
    const source = this.plant.texture.source;
    const world = this.plant.getGlobalPosition();
    const mound = this.root.getGlobalPosition();
    const visibleSprites = this.root.children.filter((c) => c instanceof Sprite && c.visible).length;
    return {
      slot: this.slot,
      visible: this.plant.visible,
      spritesOnPlot: visibleSprites,
      sheet: { w: source.width, h: source.height },
      frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
      orig: { x: orig.x, y: orig.y, w: orig.width, h: orig.height },
      anchor: { x: this.plant.anchor.x, y: this.plant.anchor.y },
      scale: { x: this.plant.scale.x, y: this.plant.scale.y },
      local: { x: this.plant.x, y: this.plant.y },
      world: { x: world.x, y: world.y },
      mound: { x: mound.x, y: mound.y },
      dx: world.x - mound.x,
      dy: world.y - mound.y,
      marker: this.showMarker,
    };
  }
}




type BasketView = {
  id: string;
  kind: string;
  name: string;
  emoji: string;
  points: number;
};
type HarvestPick = {
  sprite: Sprite;
  from: { x: number; y: number };
  hop: { x: number; y: number };
  to: { x: number; y: number };
  life: number;
  max: number;
  scale: number;
  kind: CropKind;
  itemId?: string;
};
const BASKET_VISIBLE = 8;
function smooth(k: number) {
  const t = Math.min(1, Math.max(0, k));
  return t * t * (3 - 2 * t);
}
function pickCurve(
  from: { x: number; y: number },
  hop: { x: number; y: number },
  to: { x: number; y: number },
  k: number,
) {
  const t = smooth(k);
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * hop.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * hop.y + t * t * to.y,
  };
}
function isCropKind(kind: string): kind is CropKind {
  return kind === "corn" || kind === "cotton" || kind === "strawberry" || kind === "tomato" || kind === "pumpkin" || kind === "sunflower";
}
/** How a crop sits in the basket: tall sticks up, low sits deep in the bowl. */
function basketPose(kind: CropKind): "tall" | "mid" | "low" {
  if (kind === "corn" || kind === "sunflower" || kind === "cotton") return "tall";
  if (kind === "pumpkin") return "low";
  return "mid"; // strawberry, tomato
}

/**
 * Per-kind nest tuning. Short picked frames (pumpkin / berry / tomato) bury under the
 * rim lip unless raised + scaled; cotton needs a mild lift so bolls read clearly.
 */
function basketNestBoost(kind: CropKind) {
  switch (kind) {
    case "pumpkin":
      return { yLift: 24, scaleMul: 1.65, zBias: 0 };
    case "strawberry":
    case "tomato":
      return { yLift: 18, scaleMul: 1.48, zBias: 0 };
    case "cotton":
      return { yLift: 10, scaleMul: 1.18, zBias: 0 };
    case "sunflower":
      return { yLift: 0, scaleMul: 1.0, zBias: 0 };
    case "corn":
    default:
      return { yLift: 0, scaleMul: 1.0, zBias: 0 };
  }
}

/** Seat inside the rim. Front row is lower and slightly larger; kind shifts depth/scale. */
function basketSeat(index: number, total: number, kind: CropKind = "corn") {
  const n = Math.max(1, Math.min(total, BASKET_VISIBLE));
  const i = Math.min(index, BASKET_VISIBLE - 1);
  const cols = n <= 3 ? n : n <= 6 ? 3 : 4;
  const col = i % cols;
  const row = Math.floor(i / cols);
  const rows = Math.ceil(n / cols);
  const pose = basketPose(kind);
  const boost = basketNestBoost(kind);
  // Wide shallow tray — spread produce across the bowl; keep tall tops peeking over the rim.
  // Short crops get a bit more lateral room so they are not stacked under tall stems.
  const spread = pose === "tall" ? 36 : pose === "low" ? 48 : 44;
  const x = (col - (cols - 1) / 2) * spread + ((row % 2) * 8 - 4);
  // Anchor is bottom of sprite. Higher y = deeper in the tray (behind front rim).
  // Tall crops sit a touch higher so corn/sunflower/cotton tops peek over the rim.
  // Short crops sit nearer the rim lip (lower y) so fruit is not fully hidden by the weave.
  const yBase = pose === "tall" ? 8 : pose === "low" ? 22 : 14;
  const y = yBase - boost.yLift - row * (pose === "tall" ? 8 : 10) + (rows - 1) * 2;
  const scaleBase = pose === "tall" ? 0.36 : pose === "low" ? 0.34 : 0.36;
  const scale = (scaleBase - row * 0.025) * boost.scaleMul;
  const rot = ((i * 17) % 11 - 5) * 0.025;
  // Back rows (higher row) draw behind; tall crops also prefer back so they tower over mid/low.
  const z = row + (pose === "tall" ? 2 : pose === "low" ? 0 : 1) + boost.zBias;
  return { x, y, scale, rot, z, pose };
}

class HarvestBasket {
  readonly root = new Container();
  private shadow = new Graphics();
  private bodyBack: Sprite;
  private rimFront: Sprite;
  private produce = new Container();
  /**
   * Soft pocket mask for the wide shallow tray: clips buried bottoms into the weave,
   * chimney stays tall so corn / sunflower / cotton tops peek over the rim.
   * IMPORTANT: never destroy this Graphics — remasking after destroy nukes `_gpuData`.
   */
  private brim = new Graphics();
  private count = new Text({
    text: "",
    style: {
      fontFamily: "Fredoka, sans-serif",
      fontSize: 22,
      fill: 0xfff6df,
      fontWeight: "800",
      stroke: { color: 0x3d2412, width: 4 },
    },
  });
  /** Wood bubble over the tray showing total ★ waiting to sell (Farmers Market total). */
  private pointsBadge = new Container();
  private pointsBubble = new Graphics();
  private pointsLabel = new Text({
    text: "",
    style: {
      fontFamily: "Fredoka, sans-serif",
      fontSize: 26,
      fill: 0xfff6df,
      fontWeight: "800",
      stroke: { color: 0x3d2412, width: 4 },
    },
  });
  private held: BasketView[] = [];
  private hidden = new Set<string>();
  private pulseT = 0;
  private baseScale: number = GARDEN_BASKET_LAYOUT.emptyScale;
  private origin = {
    x: GARDEN_ZOOM_TEXTURE.width * GARDEN_BASKET_LAYOUT.origin.u,
    y: GARDEN_ZOOM_TEXTURE.height * GARDEN_BASKET_LAYOUT.origin.v,
  };
  /** Empty basket on grass — slightly larger than the approved mock (0.82). */
  private emptyScale = GARDEN_BASKET_LAYOUT.emptyScale;
  /** Filled grows further in the same outside-fence pocket. */
  private filledScale = GARDEN_BASKET_LAYOUT.filledScale;

  constructor(private painted: PaintedArt, onOpen: () => void) {
    this.root.sortableChildren = true;
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.zIndex = 400;

    this.shadow.zIndex = 0;
    this.bodyBack = new Sprite(painted.harvestBasket);
    // Rim-center on the wide shallow tray art (shared body/rim canvas; no handle).
    this.bodyBack.anchor.set(0.5, 0.55);
    // Preserve texture aspect — never force a square draw rect.
    const baskW = 260;
    const tex = painted.harvestBasket;
    const baskH = tex.width > 0 ? baskW * (tex.height / tex.width) : 160;
    this.bodyBack.width = baskW;
    this.bodyBack.height = baskH;
    this.bodyBack.alpha = 1;
    this.bodyBack.zIndex = 1;

    this.produce.sortableChildren = true;
    this.produce.zIndex = 2;

    this.rimFront = new Sprite(painted.harvestBasketRim);
    this.rimFront.anchor.set(0.5, 0.55);
    this.rimFront.width = baskW;
    this.rimFront.height = baskH;
    this.rimFront.alpha = 1;
    this.rimFront.zIndex = 3;

    this.count.anchor.set(0.5, 0);
    this.count.position.set(0, 52);
    this.count.zIndex = 4;

    this.pointsBadge.zIndex = 5;
    this.pointsBadge.visible = false;
    this.pointsBadge.eventMode = "none";
    this.pointsLabel.anchor.set(0.5, 0.5);
    this.pointsBadge.addChild(this.pointsBubble, this.pointsLabel);
    this.pointsBadge.position.set(0, -78);

    this.drawPocketMask();
    // Soft pocket only — prefer seating so tops peek over the rim; keep brim Graphics alive.
    this.produce.mask = this.brim;
    this.produce.addChild(this.brim);
    this.drawShadow();
    this.root.addChild(this.shadow, this.bodyBack, this.produce, this.rimFront, this.count, this.pointsBadge);
    this.root.on("pointerup", (ev) => {
      ev.stopPropagation();
      onOpen();
    });
    this.root.hitArea = new Ellipse(0, 10, 130, 64);
    this.applyFillScale();
  }

  private drawPocketMask() {
    const g = this.brim;
    g.clear();
    // Wide shallow-tray chimney: clips buried bottoms into the weave, never haircuts tops.
    g.moveTo(-130, -300);
    g.lineTo(130, -300);
    g.lineTo(148, 30);
    g.quadraticCurveTo(0, 72, -148, 30);
    g.closePath();
    g.fill({ color: 0xffffff });
  }

  private drawShadow() {
    const g = this.shadow;
    g.clear();
    g.ellipse(4, 48, 110, 20);
    g.fill({ color: 0x1c1208, alpha: 0.28 });
  }

  place(tw: number, th: number) {
    // Grass outside the fenced dirt, touching the lower-right fence corner.
    // Stay clear of the centered bottom toolbar (Chores / Water / Seeds).
    this.origin = {
      x: tw * GARDEN_BASKET_LAYOUT.origin.u,
      y: th * GARDEN_BASKET_LAYOUT.origin.v,
    };
    this.root.position.set(this.origin.x, this.origin.y);
    this.root.zIndex = 6500;
    this.applyFillScale();
  }

  private visibleCount() {
    return this.held.filter((item) => !this.hidden.has(item.id)).length;
  }

  private waitingPoints() {
    return this.held.reduce((sum, item) => sum + (item.points || 0), 0);
  }

  private applyFillScale() {
    this.baseScale = this.visibleCount() > 0 ? this.filledScale : this.emptyScale;
    this.root.scale.set(this.baseScale);
  }

  /** Gentle idle pulse while produce is waiting — stops when empty. */
  update(dt: number) {
    const filled = this.visibleCount() > 0;
    if (!filled) {
      this.pulseT = 0;
      this.root.scale.set(this.baseScale);
      return;
    }
    this.pulseT += dt;
    // Slow kid-friendly breathe (~1.6s cycle), ~4% scale swing.
    const pulse = 1 + Math.sin(this.pulseT * 3.9) * 0.04;
    this.root.scale.set(this.baseScale * pulse);
  }

  private syncPointsBadge() {
    const pts = this.waitingPoints();
    const show = pts > 0 && this.visibleCount() > 0;
    this.pointsBadge.visible = show;
    if (!show) {
      this.pointsLabel.text = "";
      return;
    }
    this.pointsLabel.text = `\u2605 ${pts}`;
    const padX = 18;
    const padY = 10;
    const tw = Math.max(48, this.pointsLabel.width);
    const th = Math.max(26, this.pointsLabel.height);
    const w = tw + padX * 2;
    const h = th + padY * 2;
    const g = this.pointsBubble;
    g.clear();
    g.roundRect(-w / 2, -h / 2, w, h, h / 2);
    g.fill({ color: 0x6b3e1f });
    g.stroke({ color: 0x3d2412, width: 3 });
    g.roundRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, (h - 6) / 2);
    g.stroke({ color: 0xc4a06a, width: 2, alpha: 0.85 });
  }

  private scaledLocal(lx: number, ly: number) {
    // Use fill base scale (not the idle pulse) so harvest landings and star launches stay steady.
    return {
      x: this.origin.x + lx * this.baseScale,
      y: this.origin.y + ly * this.baseScale,
    };
  }

  mouth() {
    return this.scaledLocal(0, -8);
  }

  reserveSlot(itemId?: string, kind?: string) {
    if (itemId) this.hidden.add(itemId);
    const index = this.held.findIndex((item) => item.id === itemId);
    const crop = (kind && isCropKind(kind) ? kind : undefined)
      ?? (index >= 0 && isCropKind(this.held[index]!.kind) ? this.held[index]!.kind : "corn");
    const seat = basketSeat(
      index >= 0 ? index : this.held.length,
      this.held.length + (index >= 0 ? 0 : 1),
      crop,
    );
    return this.scaledLocal(seat.x, seat.y - 6);
  }

  release(itemId?: string) {
    if (!itemId) return;
    this.hidden.delete(itemId);
    this.redraw();
  }

  sync(items: BasketView[], flying: Set<string>) {
    this.held = items;
    this.hidden = new Set(flying);
    this.redraw();
  }

  private redraw() {
    for (let i = this.produce.children.length - 1; i >= 0; i--) {
      const child = this.produce.children[i]!;
      if (child === this.brim) continue;
      this.produce.removeChild(child);
      child.destroy();
    }
    if (this.produce.mask !== this.brim) this.produce.mask = this.brim;
    if (this.brim.parent !== this.produce) this.produce.addChild(this.brim);
    this.drawPocketMask();
    const shown = this.held.slice(0, BASKET_VISIBLE);
    shown.forEach((item, index) => {
      if (this.hidden.has(item.id)) return;
      const kind = isCropKind(item.kind) ? item.kind : "corn";
      const tex = cropPickedFrame(this.painted.crops, kind);
      if (!tex?.source) return;
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5, 1);
      const seat = basketSeat(index, shown.length, kind);
      sprite.position.set(seat.x, seat.y);
      sprite.scale.set(seat.scale);
      sprite.rotation = seat.rot;
      // Front of bowl (low z row) draws on top of buried pumpkins; tall back towers.
      sprite.zIndex = 20 - seat.z;
      this.produce.addChild(sprite);
    });
    const extra = Math.max(0, this.held.length - BASKET_VISIBLE);
    this.count.text = extra > 0 ? `+${extra}` : "";
    this.syncPointsBadge();
    this.applyFillScale();
  }
}