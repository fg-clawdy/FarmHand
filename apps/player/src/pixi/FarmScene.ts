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
    const forbidden = cowForbiddenRects(tw, th);
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
