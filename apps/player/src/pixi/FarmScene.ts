import { cropKindForTier, type FarmPlayerCard } from "@farmhand/shared";
import { Container, Graphics, Point, Sprite, Text, type Application } from "pixi.js";
import { ACCENTS } from "../theme";
import { ExhaustPuff, PaintedCow } from "./ambient";
import type { Atlas } from "./atlas";
import { coverFit } from "./draw";
import type { PixiEngine } from "./engine";
import { SparkleField } from "./fx";
import { CorkboardHotspot, type WantedJob } from "./jobBoard";
import {
  FARM_MOUND_COVER_PX,
  cropCoverScale,
  cropDiscAnchor,
  cropStageFrame,
  type PaintedArt,
} from "./paintedAssets";
import { SignAvatarBadge, farmSignBadgeLocal } from "./signAvatar";
import {
  PLAYABLE_PLOT_SLOTS,
  PLAYFIELD_TEXTURE,
  PLAYFIELD_LAYOUT,
  cowForbiddenRects,
  gardenSignFontPx,
  gardenSignName,
  gardenSignPlankLocal,
  gardenSignPoints,
  gardenSignSeeds,
  GARDEN_SIGN_PLANKS,
  moundUv,
  uvRectToLocal,
  uvToLocal,
} from "./playfieldLayout";

export class FarmScene {
  readonly root = new Container();
  private fill = new Graphics();
  private playfield = new Container();
  private ground: Sprite;
  private beds: GardenHotspot[] = [];
  private cow: PaintedCow;
  private exhaust: ExhaustPuff;
  private store: Container;
  private jobBoard: CorkboardHotspot;
  private app: Application;
  private onPlayer: (id: string) => void;
  private onStore: () => void;
  private onJobBoard: () => void;
  private onAvatar: (id: string) => void;
  private t = 0;

  constructor(
    engine: PixiEngine,
    atlas: Atlas,
    painted: PaintedArt,
    handlers: { onPlayer: (id: string) => void; onStore: () => void; onJobBoard?: () => void; onAvatar?: (id: string) => void },
  ) {
    this.app = engine.app;
    this.onPlayer = handlers.onPlayer;
    this.onStore = handlers.onStore;
    this.onJobBoard = handlers.onJobBoard ?? (() => undefined);
    this.onAvatar = handlers.onAvatar ?? (() => undefined);

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
    const forbidden = cowForbiddenRects(tw, th);
    const start = uvToLocal(PLAYFIELD_LAYOUT.cowStart, tw, th);
    this.cow = new PaintedCow({ walk: painted.cowWalk, eat: painted.cowEat }, start.x, start.y, roam, forbidden);
    this.playfield.addChild(this.cow.root);

    this.store = this.makeStoreHit(tw, th);
    this.playfield.addChild(this.store);

    this.jobBoard = new CorkboardHotspot(painted, tw, th, () => this.onJobBoard());
    this.playfield.addChild(this.jobBoard.root);

    for (let i = 0; i < 3; i++) {
      const bed = new GardenHotspot(
        atlas,
        painted,
        PLAYFIELD_LAYOUT.gardens[i]!,
        (id) => this.onPlayer(id),
        (id) => this.onAvatar(id),
      );
      bed.place(tw, th);
      this.beds.push(bed);
      this.playfield.addChild(bed.root);
    }

    this.root.addChild(this.fill, this.playfield);
    this.app.stage.removeChildren();
    this.app.stage.addChild(this.root);
    exposeFarmDebug(this);

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
    players.forEach((player, i) => {
      this.beds[i]?.sync(player, ACCENTS[i % ACCENTS.length]);
    });
  }

  /** Game Engineer: highlighted open chores for Wanted rotation. */
  setWantedJobs(jobs: WantedJob[], dwellSeconds?: number) {
    this.jobBoard.setJobs(jobs, dwellSeconds);
  }

  getCurrentWantedJob() {
    return this.jobBoard.getCurrentJob();
  }

  /** QA only (`/qa/farm?markers=1`). Default off — never drawn on the live farm. */
  setMoundMarkers(on: boolean) {
    this.beds.forEach((bed) => bed.setMoundMarkers(on));
  }

  /** Public so the hook can re-fit after canvas reparent. */
  relayout() {
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
    // Sign lines are children of this container, placed in texture UV space.
    // Resize only cover-fits the painting — do not re-place text in screen pixels.
    this.playfield.scale.set(fit.scale);
    this.playfield.position.set(fit.x, fit.y);
  }

  private tick(dt: number) {
    this.t += dt;
    this.cow.update(dt);
    this.jobBoard.update(dt);
    this.beds.forEach((b) => b.breathe(this.t));
  }

  destroy() {
    this.app.ticker.remove(this.onTick);
    this.app.renderer.off("resize", this.onResize);
    if (farmDebugOwner === this) {
      farmDebugOwner = null;
      const w = globalThis as { __farmhandFarmDebug?: unknown; __farmhandFarmCanvas?: unknown; __farmhandJobBoard?: unknown };
      if (w.__farmhandFarmDebug) delete w.__farmhandFarmDebug;
      if (w.__farmhandFarmCanvas) delete w.__farmhandFarmCanvas;
      if (w.__farmhandJobBoard) delete w.__farmhandJobBoard;
    }
    this.root.removeFromParent();
    this.root.destroy({ children: true, texture: false, textureSource: false });
  }

  debugJobBoard() {
    const tw = this.ground.texture.width || PLAYFIELD_TEXTURE.width;
    const th = this.ground.texture.height || PLAYFIELD_TEXTURE.height;
    return this.jobBoard.debugHit(tw, th);
  }

  debugPlants() {
    const tw = this.ground.texture.width || PLAYFIELD_TEXTURE.width;
    const th = this.ground.texture.height || PLAYFIELD_TEXTURE.height;
    const fit = coverFit(this.app.screen.width, this.app.screen.height, tw, th);
    const playfieldDrift = {
      scale: this.playfield.scale.x - fit.scale,
      x: this.playfield.position.x - fit.x,
      y: this.playfield.position.y - fit.y,
    };
    return this.beds.flatMap((bed, garden) =>
      bed.debugPlants(garden).map((row) => ({
        ...row,
        fit,
        view: { w: this.app.screen.width, h: this.app.screen.height },
        playfieldDrift,
        ground: { w: this.ground.width, h: this.ground.height, tw, th },
      })),
    );
  }
}

let farmDebugOwner: FarmScene | null = null;

function exposeFarmDebug(scene: FarmScene) {
  if (typeof location === "undefined" || !location.pathname.startsWith("/qa/")) return;
  farmDebugOwner = scene;
  const w = globalThis as {
    __farmhandFarmDebug?: () => ReturnType<FarmScene["debugPlants"]>;
    __farmhandFarmCanvas?: () => HTMLCanvasElement | OffscreenCanvas | undefined;
    __farmhandJobBoard?: () => ReturnType<FarmScene["debugJobBoard"]>;
  };
  w.__farmhandFarmDebug = () => scene.debugPlants();
  w.__farmhandFarmCanvas = () => scene["app"]?.canvas;
  w.__farmhandJobBoard = () => scene.debugJobBoard();
}

function gardenSignText(
  fontSize: number,
  weight: "600" | "700",
  strokeWidth: number,
  shadow: { alpha: number; blur: number; distance: number },
) {
  const text = new Text({
    text: "",
    style: {
      fontFamily: "Fredoka, sans-serif",
      fontSize,
      fill: 0xfff6df,
      fontWeight: weight,
      stroke: { color: 0x2a1608, width: strokeWidth },
      dropShadow: {
        color: 0x140c06,
        alpha: shadow.alpha,
        blur: shadow.blur,
        distance: shadow.distance,
      },
      align: "center",
      wordWrap: false,
    },
  });
  text.anchor.set(0.5, 0.5);
  return text;
}

/** Invisible garden tap target + one Fredoka line on each painted sign plank. */
class GardenHotspot {
  readonly root = new Container();
  private hit = new Graphics();
  private plaque = new Container();
  private nameText: Text;
  private seedsText: Text;
  private pointsText: Text;
  private avatarBadge: SignAvatarBadge;
  private sparkles: SparkleField[] = [];
  private plants: Sprite[] = [];
  private approvalAuras: Graphics[] = [];
  private markers: Graphics[] = [];
  private showMarkers = false;
  private cropScale = 0.16;
  private playerId = "";
  private texW: number = PLAYFIELD_TEXTURE.width;
  private texH: number = PLAYFIELD_TEXTURE.height;
  private spec: (typeof PLAYFIELD_LAYOUT.gardens)[number];
  private painted: PaintedArt;

  constructor(
    atlas: Atlas,
    painted: PaintedArt,
    spec: (typeof PLAYFIELD_LAYOUT.gardens)[number],
    onOpen: (id: string) => void,
    onAvatar: (id: string) => void,
  ) {
    this.spec = spec;
    this.painted = painted;
    this.nameText = gardenSignText(26, "700", 5, { alpha: 0.55, blur: 4, distance: 2 });
    this.seedsText = gardenSignText(18, "600", 4, { alpha: 0.45, blur: 3, distance: 1 });
    this.pointsText = gardenSignText(18, "600", 4, { alpha: 0.45, blur: 3, distance: 1 });
    this.plaque.addChild(this.nameText, this.seedsText, this.pointsText);
    this.avatarBadge = new SignAvatarBadge(() => {
      if (this.playerId) onAvatar(this.playerId);
    });
    for (let i = 0; i < PLAYABLE_PLOT_SLOTS; i++) {
      const spr = new Sprite();
      spr.anchor.set(0.5, 1);
      spr.visible = false;
      this.plants.push(spr);
      const aura = new Graphics();
      aura.visible = false;
      aura.eventMode = "none";
      this.drawFarmApprovalAura(aura);
      this.approvalAuras.push(aura);
      const mark = new Graphics();
      mark.visible = false;
      mark.eventMode = "none";
      this.markers.push(mark);
      this.sparkles.push(new SparkleField(atlas, 6));
    }
    this.root.addChild(
      this.hit,
      ...this.approvalAuras,
      ...this.plants,
      ...this.markers,
      ...this.sparkles.map((field) => field.root),
      this.plaque,
      this.avatarBadge.root,
    );
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
    this.hit.clear();
    this.hit.rect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
    this.hit.fill({ color: 0xffffff, alpha: 0.001 });
    this.texW = texW;
    this.texH = texH;
    this.plaque.position.set(0, 0);
    this.placeSignLines();
    this.plants.forEach((spr, slot) => {
      const uv = moundUv(this.spec, slot);
      const p = uvToLocal(uv, texW, texH);
      spr.position.set(p.x, p.y);
      const aura = this.approvalAuras[slot]!;
      aura.position.set(p.x, p.y);
      const mark = this.markers[slot]!;
      mark.position.set(p.x, p.y);
    });
    this.drawMoundMarkers();
    this.sparkles.forEach((field, slot) => {
      const p = this.plants[slot]!;
      field.root.position.set(p.x, p.y);
      field.setArea(FARM_MOUND_COVER_PX * 0.55, FARM_MOUND_COVER_PX * 0.42);
    });
    this.root.zIndex = 3500;
  }

  /** Plank centerlines in texture pixels. Parent cover-fit handles the viewport. */
  private placeSignLines() {
    const fonts = gardenSignFontPx(this.texH);
    const lines = [this.nameText, this.seedsText, this.pointsText];
    lines.forEach((line, i) => {
      const local = gardenSignPlankLocal(this.spec.signFace, i, this.texW, this.texH);
      line.position.set(local.x, local.y);
      line.rotation = local.rotation;
      line.style.fontSize = i === 0 ? fonts.name : fonts.stats;
    });
    this.fitSignLines();
    // Circular PFP badge pinned on top-left of the existing sign (plank text unchanged).
    const nameLocal = gardenSignPlankLocal(this.spec.signFace, 0, this.texW, this.texH);
    const nameMaxW = GARDEN_SIGN_PLANKS[0]!.maxU * this.texW;
    const scale = this.texH / PLAYFIELD_TEXTURE.height;
    const badge = farmSignBadgeLocal(nameLocal, nameMaxW, 20 * scale);
    this.avatarBadge.place(badge.x, badge.y, badge.radius);
  }

  private fitSignLines() {
    const lines = [this.nameText, this.seedsText, this.pointsText];
    lines.forEach((line, i) => {
      const maxW = GARDEN_SIGN_PLANKS[i]!.maxU * this.texW;
      line.scale.set(1);
      const w = line.width;
      if (w > maxW && w > 0) line.scale.set(maxW / w);
    });
  }

  setMoundMarkers(on: boolean) {
    this.showMarkers = on;
    this.drawMoundMarkers();
  }

  private drawMoundMarkers() {
    this.markers.forEach((mark) => {
      mark.clear();
      mark.visible = this.showMarkers;
      if (!this.showMarkers) return;
      mark.circle(0, 0, 7);
      mark.fill({ color: 0xffffff });
      mark.circle(0, 0, 7);
      mark.stroke({ width: 2, color: 0x1a1008 });
      mark.moveTo(-12, 0);
      mark.lineTo(12, 0);
      mark.moveTo(0, -12);
      mark.lineTo(0, 12);
      mark.stroke({ width: 2, color: 0xe10600 });
    });
  }

  sync(player: FarmPlayerCard, accent: (typeof ACCENTS)[number]) {
    this.playerId = player.id;
    this.avatarBadge.sync(player);
    this.nameText.text = gardenSignName(player.name);
    this.seedsText.text = gardenSignSeeds(player.seeds + player.provisionalSeeds);
    this.pointsText.text = gardenSignPoints(player.points);
    this.nameText.style.fill = 0xfff6df;
    this.seedsText.style.fill = 0xfff6df;
    this.pointsText.style.fill = 0xfff6df;
    const stroke = { color: Number(accent.border.replace("#", "0x")), width: 5 };
    this.nameText.style.stroke = stroke;
    this.seedsText.style.stroke = { ...stroke, width: 4 };
    this.pointsText.style.stroke = { ...stroke, width: 4 };
    this.fitSignLines();
    const plots = Array.from({ length: PLAYABLE_PLOT_SLOTS }, (_, slot) => player.plots?.find((p) => p.slot === slot));
    this.sparkles.forEach((field, slot) => {
      field.setActive(Boolean(plots[slot]?.ready));
    });
    this.plants.forEach((spr, slot) => {
      const plot = plots[slot];
      const stage = plot?.growthStage;
      const aura = this.approvalAuras[slot]!;
      if (!plot || plot.state === "empty" || !stage || !plot.tier) {
        spr.visible = false;
        aura.visible = false;
        return;
      }
      const kind = cropKindForTier(plot.tier);
      spr.texture = cropStageFrame(this.painted.crops, kind, stage);
      const pivot = cropDiscAnchor(kind, stage);
      spr.anchor.set(pivot.x, pivot.y);
      this.cropScale = cropCoverScale(kind, stage, FARM_MOUND_COVER_PX);
      spr.scale.set(this.cropScale);
      spr.visible = true;
      const wilted = plot.state === "wilted" || Boolean(plot.greyed);
      const awaiting = Boolean(plot.awaitingApproval) || plot.state === "purgatory";
      spr.tint = wilted ? 0x8a8a8a : awaiting ? 0xe8d7ff : 0xffffff;
      aura.visible = awaiting && !wilted;
    });
  }

  breathe(t: number) {
    this.plants.forEach((spr, i) => {
      if (!spr.visible) return;
      const s = spr.scale.x;
      spr.scale.set(s, s * (1 + Math.sin(t * 1.5 + i) * 0.01));
      const aura = this.approvalAuras[i]!;
      if (aura.visible) {
        aura.alpha = 0.88 + Math.sin(t * 2.4 + i) * 0.12;
        const pulse = 1 + Math.sin(t * 2.4 + i) * 0.08;
        aura.scale.set(pulse, pulse * 0.9);
      }
    });
    this.sparkles.forEach((field) => field.update(t));
  }

  private drawFarmApprovalAura(g: Graphics) {
    g.clear();
    g.ellipse(0, 6, 46, 26);
    g.fill({ color: 0x9b5cff, alpha: 0.28 });
    g.ellipse(0, 4, 34, 20);
    g.fill({ color: 0xb57bff, alpha: 0.45 });
    g.ellipse(0, 2, 22, 13);
    g.fill({ color: 0xe8d7ff, alpha: 0.4 });
  }

  debugPlants(garden: number) {
    return this.plants.map((spr, slot) => {
      const frame = spr.texture.frame;
      const world = spr.getGlobalPosition();
      const mound = this.root.toGlobal(new Point(spr.x, spr.y));
      const uv = moundUv(this.spec, slot);
      return {
        garden,
        slot,
        visible: spr.visible,
        frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
        anchor: { x: spr.anchor.x, y: spr.anchor.y },
        scale: { x: spr.scale.x, y: spr.scale.y },
        local: { x: spr.x, y: spr.y },
        uv,
        world: { x: world.x, y: world.y },
        mound: { x: mound.x, y: mound.y },
        dx: world.x - mound.x,
        dy: world.y - mound.y,
        marker: this.showMarkers,
        sparkle: {
          active: this.sparkles[slot]?.isActive ?? false,
          local: { x: this.sparkles[slot]?.root.x ?? 0, y: this.sparkles[slot]?.root.y ?? 0 },
        },
      };
    });
  }
}
