import { cropKindForTier, type FarmPlayerCard } from "@farmhand/shared";
import { Container, Graphics, Point, Sprite, Text, type Application } from "pixi.js";
import { ACCENTS } from "../theme";
import { ExhaustPuff, PaintedCow } from "./ambient";
import type { Atlas } from "./atlas";
import { coverFit } from "./draw";
import type { PixiEngine } from "./engine";
import { SparkleField } from "./fx";
import {
  FARM_MOUND_COVER_PX,
  cropCoverScale,
  cropDiscAnchor,
  cropStageFrame,
  type PaintedArt,
} from "./paintedAssets";
import {
  PLAYABLE_PLOT_SLOTS,
  PLAYFIELD_TEXTURE,
  PLAYFIELD_LAYOUT,
  cowForbiddenRects,
  gardenSignName,
  gardenSignStats,
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
  private t = 0;

  constructor(
    engine: PixiEngine,
    atlas: Atlas,
    painted: PaintedArt,
    handlers: { onPlayer: (id: string) => void; onStore: () => void; onJobBoard: () => void },
  ) {
    this.app = engine.app;
    this.onPlayer = handlers.onPlayer;
    this.onStore = handlers.onStore;
    this.onJobBoard = handlers.onJobBoard;

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

    this.jobBoard = new CorkboardHotspot(tw, th, () => this.onJobBoard());
    this.playfield.addChild(this.jobBoard.root);

    for (let i = 0; i < 3; i++) {
      const bed = new GardenHotspot(atlas, painted, PLAYFIELD_LAYOUT.gardens[i]!, (id) => this.onPlayer(id));
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

  setWantedJobs(jobs: WantedJob[]) {
    this.jobBoard.setJobs(jobs);
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
      const w = globalThis as { __farmhandFarmDebug?: unknown };
      if (w.__farmhandFarmDebug) delete w.__farmhandFarmDebug;
    }
    this.root.removeFromParent();
    this.root.destroy({ children: true });
  }

  debugPlants() {
    return this.beds.flatMap((bed, garden) => bed.debugPlants(garden));
  }
}

export type WantedJob = {
  id: string;
  title: string;
  emoji: string;
  priority: string;
};

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Painted corkboard + rotating Wanted poster on the main farm (not a garden plot). */
class CorkboardHotspot {
  readonly root = new Container();
  private poster = new Container();
  private paper = new Graphics();
  private pinHead = new Graphics();
  private banner: Text;
  private emojiText: Text;
  private titleText: Text;
  private chipText: Text;
  private jobs: WantedJob[] = [];
  private index = 0;
  private phase: "show" | "tear" | "pin" = "show";
  private phaseT = 0;
  private restX = 0;
  private restY = 0;
  private boardW = 0;
  private boardH = 0;

  constructor(texW: number, texH: number, onOpen: () => void) {
    const rect = uvRectToLocal(PLAYFIELD_LAYOUT.jobBoardHit, texW, texH);
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    this.boardW = w;
    this.boardH = h;
    this.root.position.set(rect.x0, rect.y0);

    const board = new Graphics();
    board.roundRect(0, 18, w, h - 18, 14);
    board.fill(0x6b3a18);
    board.roundRect(10, 28, w - 20, h - 38, 10);
    board.fill(0xc48a4a);
    board.roundRect(16, 34, w - 32, h - 50, 8);
    board.fill(0xd4a05c);
    for (let i = 0; i < 18; i++) {
      const px = 24 + ((i * 47) % (w - 48));
      const py = 42 + ((i * 31) % (h - 70));
      board.circle(px, py, 2.2);
      board.fill({ color: 0xa56b32, alpha: 0.45 });
    }

    const label = new Text({
      text: "Job Board",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 26,
        fill: 0xfff8ec,
        fontWeight: "700",
        stroke: { color: 0x3a2410, width: 5 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(w / 2, 16);

    this.banner = new Text({
      text: "WANTED",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 13,
        fill: 0x9b2c1f,
        fontWeight: "800",
        letterSpacing: 1.2,
      },
    });
    this.banner.anchor.set(0.5, 0);
    this.emojiText = new Text({
      text: "📌",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 36, fill: 0x3a2410, align: "center" },
    });
    this.emojiText.anchor.set(0.5, 0);
    this.titleText = new Text({
      text: "Open jobs",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 16,
        fill: 0x3a2410,
        fontWeight: "700",
        wordWrap: true,
        wordWrapWidth: Math.max(80, w - 64),
        align: "center",
      },
    });
    this.titleText.anchor.set(0.5, 0);
    this.chipText = new Text({
      text: "+1 waiting seed",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 12,
        fill: 0x5c3218,
        fontWeight: "700",
        align: "center",
      },
    });
    this.chipText.anchor.set(0.5, 0);

    this.poster.addChild(this.paper, this.banner, this.emojiText, this.titleText, this.chipText, this.pinHead);
    this.restX = w / 2;
    this.restY = 28 + (h - 38) / 2;
    this.poster.position.set(this.restX, this.restY);
    this.paintPoster(null);

    const hit = new Graphics();
    hit.rect(0, 0, w, h);
    hit.fill({ color: 0xffffff, alpha: 0.001 });

    this.root.addChild(board, this.poster, label, hit);
    this.root.zIndex = 4200;
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerup", onOpen);
  }

  setJobs(jobs: WantedJob[]) {
    const same =
      jobs.length === this.jobs.length && jobs.every((job, i) => job.id === this.jobs[i]?.id);
    this.jobs = jobs;
    if (!same) {
      this.index = 0;
      this.phase = "show";
      this.phaseT = 0;
      this.resetPosterPose();
      this.paintPoster(this.jobs[0] ?? null);
    }
  }

  update(dt: number) {
    if (this.jobs.length < 2) {
      this.resetPosterPose();
      return;
    }
    this.phaseT += dt;
    if (this.phase === "show") {
      this.resetPosterPose();
      if (this.phaseT >= 4.2) {
        this.phase = "tear";
        this.phaseT = 0;
      }
      return;
    }
    if (this.phase === "tear") {
      const p = Math.min(1, this.phaseT / 0.5);
      this.poster.rotation = p * 0.55;
      this.poster.position.set(this.restX + p * 36, this.restY + p * 90);
      this.poster.alpha = 1 - p;
      if (p >= 1) {
        this.index = (this.index + 1) % this.jobs.length;
        this.paintPoster(this.jobs[this.index] ?? null);
        this.phase = "pin";
        this.phaseT = 0;
        this.poster.rotation = -0.08;
        this.poster.position.set(this.restX, this.restY - 12);
        this.poster.alpha = 1;
        this.poster.scale.set(0.35);
      }
      return;
    }
    const p = Math.min(1, this.phaseT / 0.45);
    const eased = easeOutBack(p);
    this.poster.scale.set(0.35 + 0.65 * eased);
    this.poster.rotation = -0.08 * (1 - p);
    this.poster.position.set(this.restX, this.restY - 12 * (1 - p));
    this.poster.alpha = 1;
    if (p >= 1) {
      this.phase = "show";
      this.phaseT = 0;
      this.resetPosterPose();
    }
  }

  private resetPosterPose() {
    this.poster.rotation = 0;
    this.poster.alpha = 1;
    this.poster.scale.set(1);
    this.poster.position.set(this.restX, this.restY);
  }

  private paintPoster(job: WantedJob | null) {
    const pw = Math.max(88, this.boardW - 48);
    const ph = Math.max(110, this.boardH - 64);
    const critical = job?.priority === "CRITICAL";
    this.paper.clear();
    this.paper.roundRect(-pw / 2, -ph / 2, pw, ph, 6);
    this.paper.fill(critical ? 0xf3c4b8 : 0xfff6df);
    this.paper.stroke({ color: critical ? 0x9b2c1f : 0x8a4f2a, width: 3 });
    this.pinHead.clear();
    this.pinHead.circle(0, -ph / 2 + 8, 6);
    this.pinHead.fill(critical ? 0x9b2c1f : 0x3f8a3a);
    this.pinHead.circle(0, -ph / 2 + 8, 2.5);
    this.pinHead.fill(0xfff8ec);
    this.banner.text = critical ? "WANTED" : "HELP WANTED";
    this.banner.style.fill = critical ? 0x9b2c1f : 0x5c3218;
    this.banner.position.set(0, -ph / 2 + 14);
    this.emojiText.text = job?.emoji || "📌";
    this.emojiText.position.set(0, -ph / 2 + 28);
    this.titleText.text = job?.title || "No open jobs";
    this.titleText.style.wordWrapWidth = pw - 16;
    this.titleText.position.set(0, -8);
    this.chipText.text = job ? "+1 waiting seed" : "Check back soon";
    this.chipText.position.set(0, ph / 2 - 22);
  }
}

let farmDebugOwner: FarmScene | null = null;

function exposeFarmDebug(scene: FarmScene) {
  farmDebugOwner = scene;
  (globalThis as { __farmhandFarmDebug?: () => ReturnType<FarmScene["debugPlants"]> }).__farmhandFarmDebug = () =>
    scene.debugPlants();
}

/** Invisible garden tap target + live name on the blank wooden sign. */
class GardenHotspot {
  readonly root = new Container();
  private hit = new Graphics();
  private plaque = new Container();
  private nameText: Text;
  private statsText: Text;
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
        fontSize: 40,
        fill: 0xfff6df,
        fontWeight: "700",
        stroke: { color: 0x2a1608, width: 5 },
        dropShadow: {
          color: 0x140c06,
          alpha: 0.55,
          blur: 4,
          distance: 2,
        },
        align: "center",
      },
    });
    this.nameText.anchor.set(0.5, 1);
    this.statsText = new Text({
      text: "",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 20,
        fill: 0xfff6df,
        fontWeight: "600",
        stroke: { color: 0x2a1608, width: 4 },
        dropShadow: {
          color: 0x140c06,
          alpha: 0.45,
          blur: 3,
          distance: 1,
        },
        align: "center",
      },
    });
    this.statsText.anchor.set(0.5, 0);
    this.plaque.addChild(this.nameText, this.statsText);
    this.sparkle = new SparkleField(atlas, 8);
    for (let i = 0; i < PLAYABLE_PLOT_SLOTS; i++) {
      const spr = new Sprite();
      spr.anchor.set(0.5, 1);
      spr.visible = false;
      this.plants.push(spr);
    }
    this.root.addChild(this.hit, ...this.plants, this.sparkle.root, this.plaque);
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
    this.plaque.position.set(sign.x, sign.y);
    const nameSize = Math.max(30, (rect.x1 - rect.x0) * 0.12);
    this.nameText.style.fontSize = nameSize;
    this.statsText.style.fontSize = Math.max(18, nameSize * 0.52);
    this.nameText.position.set(0, -2);
    this.statsText.position.set(0, 2);
    const soil = uvRectToLocal(this.spec.soil, texW, texH);
    this.plants.forEach((spr, slot) => {
      const uv = moundUv(this.spec, slot);
      const p = uvToLocal(uv, texW, texH);
      spr.position.set(p.x, p.y);
    });
    this.sparkle.root.position.set((soil.x0 + soil.x1) / 2, (soil.y0 + soil.y1) / 2);
    this.sparkle.setArea((soil.x1 - soil.x0) * 0.36, (soil.y1 - soil.y0) * 0.22);
    this.root.zIndex = 3500;
  }

  sync(player: FarmPlayerCard, accent: (typeof ACCENTS)[number]) {
    this.playerId = player.id;
    this.nameText.text = gardenSignName(player.name);
    this.statsText.text = gardenSignStats(player.seeds, player.points);
    this.nameText.style.fill = 0xfff6df;
    this.statsText.style.fill = 0xfff6df;
    const stroke = { color: Number(accent.border.replace("#", "0x")), width: 5 };
    this.nameText.style.stroke = stroke;
    this.statsText.style.stroke = { ...stroke, width: 4 };
    this.sparkle.setActive(player.plots?.some((p) => p.ready) ?? false);
    const plots = Array.from({ length: PLAYABLE_PLOT_SLOTS }, (_, slot) => player.plots?.find((p) => p.slot === slot));
    this.plants.forEach((spr, slot) => {
      const plot = plots[slot];
      const stage = plot?.growthStage;
      if (!plot || plot.state === "empty" || !stage || !plot.tier) {
        spr.visible = false;
        return;
      }
      const kind = cropKindForTier(plot.tier);
      spr.texture = cropStageFrame(this.painted.crops, kind, stage);
      const pivot = cropDiscAnchor(kind, stage);
      spr.anchor.set(pivot.x, pivot.y);
      this.cropScale = cropCoverScale(kind, stage, FARM_MOUND_COVER_PX);
      spr.scale.set(this.cropScale);
      spr.visible = true;
      const greyed = plot.state === "purgatory" || plot.state === "wilted" || plot.greyed;
      spr.tint = greyed ? 0x8a8a8a : 0xffffff;
      spr.alpha = greyed ? 0.72 : 1;
    });
  }

  breathe(t: number) {
    this.plants.forEach((spr, i) => {
      if (!spr.visible) return;
      const s = spr.scale.x;
      spr.scale.set(s, s * (1 + Math.sin(t * 1.5 + i) * 0.01));
    });
    this.sparkle.update(t);
  }

  debugPlants(garden: number) {
    return this.plants.map((spr, slot) => {
      const frame = spr.texture.frame;
      const world = spr.getGlobalPosition();
      const mound = this.root.toGlobal(new Point(spr.x, spr.y));
      return {
        garden,
        slot,
        visible: spr.visible,
        frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height },
        anchor: { x: spr.anchor.x, y: spr.anchor.y },
        scale: { x: spr.scale.x, y: spr.scale.y },
        local: { x: spr.x, y: spr.y },
        world: { x: world.x, y: world.y },
        mound: { x: mound.x, y: mound.y },
        dx: world.x - mound.x,
        dy: world.y - mound.y,
      };
    });
  }
}
