import {
  jarTint,
  tubeFillRatio,
  type PublicSharedGoal,
} from "@farmhand/shared";
import { Assets, CanvasSource, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import type { Atlas } from "./atlas";
import { SparkleField } from "./fx";
import {
  LIBRARY_JAR_CAPACITY,
  libraryHouseMetrics,
  libraryShelfLayout,
  libraryWindow,
  type LibrarySlot,
} from "./libraryShelfLayout";
import { uvRectToLocal, type UvRect } from "./playfieldLayout";

const INK = 0x3a2410;
const JAR_RESOLUTION = 2;

function mixHex(color: string, amount: number) {
  const n = Number.parseInt(color.slice(1), 16);
  const toward = amount > 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(amount));
  const ch = (shift: number) => {
    const v = (n >> shift) & 255;
    return Math.round(v + (toward - v) * k);
  };
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

type JarGeom = {
  cx: number;
  corkH: number;
  bodyTop: number;
  bodyBot: number;
  bodyW: number;
  left: number;
  right: number;
  neckW: number;
  neckL: number;
  neckR: number;
  shoulder: number;
};

/** Chubby mason jar silhouette in logical pixels. No stroke — the fill is the glass. */
function traceJar(ctx: CanvasRenderingContext2D, w: number, h: number): JarGeom {
  const cx = w / 2;
  const corkH = h * 0.16;
  const bodyTop = h * 0.25;
  const bodyBot = h * 0.95;
  const bodyW = w * 0.86;
  const left = cx - bodyW / 2;
  const right = cx + bodyW / 2;
  const neckW = bodyW * 0.58;
  const neckL = cx - neckW / 2;
  const neckR = cx + neckW / 2;
  const shoulder = bodyTop + h * 0.09;
  const radius = Math.min(bodyW * 0.36, Math.max(3, (bodyBot - shoulder) * 0.48));
  ctx.beginPath();
  ctx.moveTo(neckL, bodyTop);
  ctx.quadraticCurveTo(left + bodyW * 0.04, bodyTop + h * 0.015, left, shoulder);
  ctx.lineTo(left, bodyBot - radius);
  ctx.quadraticCurveTo(left, bodyBot, left + radius, bodyBot);
  ctx.lineTo(right - radius, bodyBot);
  ctx.quadraticCurveTo(right, bodyBot, right, bodyBot - radius);
  ctx.lineTo(right, shoulder);
  ctx.quadraticCurveTo(right - bodyW * 0.04, bodyTop + h * 0.015, neckR, bodyTop);
  ctx.closePath();
  return { cx, corkH, bodyTop, bodyBot, bodyW, left, right, neckW, neckL, neckR, shoulder };
}

function paintJarGlass(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  glass: string,
  rim: string,
  fill: string,
  ratio: number,
) {
  const geom = traceJar(ctx, w, h);
  ctx.save();
  ctx.shadowColor = "rgba(48, 62, 18, 0.28)";
  ctx.shadowBlur = Math.max(2, h * 0.04);
  ctx.shadowOffsetY = Math.max(1, h * 0.015);
  ctx.fillStyle = "rgba(48, 62, 18, 0.01)";
  ctx.beginPath();
  ctx.ellipse(geom.cx, h * 0.97, geom.bodyW * 0.36, Math.max(1.2, h * 0.028), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const glassPaint = ctx.createLinearGradient(geom.left, 0, geom.right, 0);
  glassPaint.addColorStop(0, mixHex(glass, 0.28));
  glassPaint.addColorStop(0.42, glass);
  glassPaint.addColorStop(1, mixHex(glass, -0.16));
  ctx.save();
  ctx.shadowColor = "rgba(58, 36, 16, 0.18)";
  ctx.shadowBlur = Math.max(1.5, w * 0.06);
  ctx.fillStyle = glassPaint;
  ctx.globalAlpha = 0.94;
  traceJar(ctx, w, h);
  ctx.fill();
  ctx.restore();

  const clamped = Math.max(0, Math.min(1, ratio));
  if (clamped > 0.02) {
    const span = (geom.bodyBot - geom.bodyTop) * 0.82;
    const fillH = span * clamped;
    const fillTop = geom.bodyBot - (geom.bodyBot - geom.bodyTop) * 0.07 - fillH;
    ctx.save();
    traceJar(ctx, w, h);
    ctx.clip();
    const liquid = ctx.createLinearGradient(0, fillTop, 0, geom.bodyBot);
    liquid.addColorStop(0, mixHex(fill, 0.28));
    liquid.addColorStop(0.16, fill);
    liquid.addColorStop(1, mixHex(fill, -0.2));
    ctx.fillStyle = liquid;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(geom.left - 2, fillTop, geom.bodyW + 4, geom.bodyBot - fillTop + 4);
    ctx.beginPath();
    ctx.ellipse(geom.cx, fillTop, geom.bodyW * 0.4, Math.max(1.4, h * 0.032), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 248, 220, 0.45)";
    ctx.beginPath();
    ctx.ellipse(geom.cx - geom.bodyW * 0.06, fillTop + h * 0.008, geom.bodyW * 0.16, Math.max(0.8, h * 0.012), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  traceJar(ctx, w, h);
  ctx.clip();
  const shade = ctx.createLinearGradient(geom.left, 0, geom.right, 0);
  shade.addColorStop(0, "rgba(255,255,255,0.2)");
  shade.addColorStop(0.4, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(48, 32, 16, 0.2)");
  ctx.fillStyle = shade;
  ctx.fillRect(geom.left, geom.bodyTop, geom.bodyW, geom.bodyBot - geom.bodyTop);
  ctx.fillStyle = "rgba(255,255,255,0.38)";
  ctx.beginPath();
  ctx.ellipse(
    geom.left + geom.bodyW * 0.24,
    geom.shoulder + (geom.bodyBot - geom.shoulder) * 0.32,
    geom.bodyW * 0.07,
    (geom.bodyBot - geom.shoulder) * 0.2,
    -0.2,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.fillStyle = "rgba(48, 32, 16, 0.14)";
  ctx.beginPath();
  ctx.ellipse(geom.cx, geom.bodyBot - h * 0.025, geom.bodyW * 0.3, Math.max(1.2, h * 0.028), 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const neckGrad = ctx.createLinearGradient(geom.neckL, 0, geom.neckR, 0);
  neckGrad.addColorStop(0, mixHex(glass, 0.2));
  neckGrad.addColorStop(1, mixHex(glass, -0.1));
  ctx.fillStyle = neckGrad;
  ctx.globalAlpha = 0.94;
  ctx.beginPath();
  ctx.roundRect(geom.neckL, geom.corkH * 0.78, geom.neckW, geom.bodyTop - geom.corkH * 0.62, 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const corkW = geom.neckW * 1.12;
  const cork = ctx.createLinearGradient(geom.cx - corkW / 2, 0, geom.cx + corkW / 2, 0);
  cork.addColorStop(0, "#f6e2b4");
  cork.addColorStop(0.55, "#e4c48a");
  cork.addColorStop(1, "#b88848");
  ctx.fillStyle = cork;
  ctx.beginPath();
  ctx.roundRect(geom.cx - corkW / 2, 1, corkW, geom.corkH, Math.min(5, corkW * 0.2));
  ctx.fill();
  ctx.strokeStyle = "rgba(120, 74, 32, 0.35)";
  ctx.lineWidth = Math.max(0.6, w * 0.02);
  for (let i = 0; i < 3; i++) {
    const x = geom.cx - corkW * 0.22 + i * corkW * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, 3);
    ctx.quadraticCurveTo(x + w * 0.02, geom.corkH * 0.5, x - w * 0.01, geom.corkH - 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 244, 214, 0.4)";
  ctx.beginPath();
  ctx.ellipse(geom.cx - corkW * 0.16, geom.corkH * 0.45, corkW * 0.08, geom.corkH * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  traceJar(ctx, w, h);
  ctx.strokeStyle = rim;
  ctx.globalAlpha = 0.38;
  ctx.lineWidth = Math.max(1, geom.bodyW * 0.035);
  ctx.stroke();
  ctx.restore();

  return geom;
}

function paintOverflowChip(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const chipW = w * 0.86;
  const chipH = h * 0.62;
  const x = (w - chipW) / 2;
  const y = (h - chipH) / 2;
  ctx.save();
  ctx.shadowColor = "rgba(58, 36, 16, 0.25)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  const face = ctx.createLinearGradient(x, y, x, y + chipH);
  face.addColorStop(0, "#fff4dc");
  face.addColorStop(1, "#e4c894");
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.roundRect(x, y, chipW, chipH, 8);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(120, 74, 32, 0.4)";
  ctx.lineWidth = Math.max(1.25, w * 0.035);
  ctx.beginPath();
  ctx.roundRect(x, y, chipW, chipH, 8);
  ctx.stroke();
}

/** One mason jar on a shelf, or the +N chip when more goals exist than fit. */
class ShelfJar {
  readonly root = new Container();
  private readonly hit = new Graphics();
  private readonly canvas: HTMLCanvasElement;
  private readonly source: CanvasSource;
  private readonly texture: Texture;
  private readonly view: Sprite;
  private readonly emoji: Text;
  private readonly plus: Text;
  private readonly lid = new Sprite(Texture.EMPTY);
  private readonly sparkles: SparkleField;
  private w = 40;
  private h = 64;
  private mode: "jar" | "overflow" | "hidden" = "hidden";
  private jarId: string | null = null;
  private tintIndex = 0;
  private shown = 0;
  private target = 0;
  private ready = false;
  private paintKey = "";

  constructor(
    atlas: Atlas,
    private readonly onTap: (id: string) => void,
    private readonly onOverflow: () => void,
  ) {
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerup", (event) => {
      event.stopPropagation();
      if (this.mode === "overflow") this.onOverflow();
      else if (this.mode === "jar" && this.jarId) this.onTap(this.jarId);
    });

    this.canvas = document.createElement("canvas");
    this.source = new CanvasSource({
      resource: this.canvas,
      width: 4,
      height: 4,
      resolution: JAR_RESOLUTION,
      transparent: true,
    });
    this.texture = new Texture({ source: this.source });
    this.view = new Sprite(this.texture);
    this.view.eventMode = "none";

    this.emoji = new Text({
      text: "",
      style: {
        fontFamily: "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif",
        fontSize: 16,
        align: "center",
      },
    });
    this.emoji.anchor.set(0.5);
    this.plus = new Text({
      text: "",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 18, fill: INK, fontWeight: "700", align: "center" },
    });
    this.plus.anchor.set(0.5);
    this.lid.anchor.set(0.5);
    this.lid.visible = false;
    this.sparkles = new SparkleField(atlas, 4);
    this.sparkles.setSoft(true);
    this.root.addChild(this.hit, this.view, this.sparkles.root, this.lid, this.emoji, this.plus);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.hit.clear();
    this.hit.rect(0, 0, w, h);
    this.hit.fill({ color: 0xffffff, alpha: 0.001 });
    this.root.hitArea = new Rectangle(0, 0, w, h);
    this.paintKey = "";
  }

  setJar(jar: PublicSharedGoal) {
    const same = this.jarId === jar.id && this.mode === "jar";
    this.mode = "jar";
    this.root.eventMode = "static";
    this.root.visible = true;
    this.jarId = jar.id;
    this.tintIndex = jar.tintIndex ?? 0;
    this.ready = jar.status === "READY";
    if (!same) {
      this.lid.visible = false;
      this.lid.texture = Texture.EMPTY;
      this.paintKey = "";
    }
    const next = tubeFillRatio(jar.filledPoints, jar.targetPoints);
    if (!same) this.shown = next;
    this.target = next;
    if (this.shown > this.target) this.shown = this.target;
    this.emoji.text = jar.emoji;
    this.plus.visible = false;
    this.sparkles.setActive(this.ready);
    this.draw(this.shown);
  }

  setOverflow(count: number) {
    this.mode = "overflow";
    this.root.eventMode = "static";
    this.root.visible = true;
    this.jarId = null;
    this.emoji.visible = false;
    this.lid.visible = false;
    this.plus.visible = true;
    this.plus.text = `+${count}`;
    this.sparkles.setActive(false);
    this.paintKey = "";
    this.draw(0);
  }

  hide() {
    this.mode = "hidden";
    this.root.visible = false;
    this.root.eventMode = "none";
    this.sparkles.setActive(false);
  }

  setLid(texture: Texture | null) {
    if (!texture || this.mode !== "jar") {
      this.lid.visible = false;
      this.lid.texture = Texture.EMPTY;
      this.draw(this.shown);
      return;
    }
    this.lid.texture = texture;
    this.lid.visible = true;
    this.draw(this.shown);
  }

  update(dt: number, t: number) {
    if (!this.root.visible || this.mode !== "jar") return;
    const delta = this.target - this.shown;
    if (Math.abs(delta) < 0.002) this.shown = this.target;
    else {
      const step = Math.min(Math.abs(delta), dt / 0.45);
      this.shown = delta > 0 ? Math.min(this.target, this.shown + step) : Math.max(this.target, this.shown - step);
    }
    this.draw(this.shown);
    this.sparkles.update(t);
  }

  release() {
    this.view.texture = Texture.EMPTY;
    this.texture.destroy(true);
  }

  private draw(ratio: number) {
    if (this.mode === "jar") this.emoji.visible = !this.lid.visible;
    const key = `${this.mode}:${this.tintIndex}:${ratio.toFixed(3)}:${this.w.toFixed(1)}:${this.h.toFixed(1)}`;
    if (key === this.paintKey) return;
    this.paintKey = key;

    const lw = Math.max(2, this.w);
    const lh = Math.max(2, this.h);
    if (Math.abs(this.source.width - lw) > 0.5 || Math.abs(this.source.height - lh) > 0.5) {
      this.source.resize(lw, lh, JAR_RESOLUTION);
    }
    const ctx = this.source.context2D;
    if (!ctx) return;
    ctx.setTransform(JAR_RESOLUTION, 0, 0, JAR_RESOLUTION, 0, 0);
    ctx.clearRect(0, 0, lw, lh);

    if (this.mode === "overflow") {
      paintOverflowChip(ctx, lw, lh);
      this.plus.position.set(this.w / 2, this.h / 2);
      this.plus.style.fontSize = Math.max(14, Math.round(this.w * 0.34));
      this.view.width = this.w;
      this.view.height = this.h;
      this.source.update();
      return;
    }
    if (this.mode !== "jar") return;

    const tint = jarTint(this.tintIndex);
    const geom = paintJarGlass(ctx, lw, lh, tint.glass, tint.rim, tint.fill, ratio);
    const badgeR = geom.corkH * 0.72;
    this.emoji.visible = !this.lid.visible;
    this.emoji.style.fontSize = Math.max(10, Math.round(badgeR * 1.5));
    this.emoji.position.set(geom.cx, geom.corkH * 0.55);
    this.lid.position.set(geom.cx, geom.corkH * 0.55);
    this.lid.width = badgeR * 2;
    this.lid.height = badgeR * 2;
    const clamped = Math.max(0, Math.min(1, ratio));
    this.sparkles.root.position.set(geom.cx, geom.bodyTop + (geom.bodyBot - geom.bodyTop) * (1 - clamped * 0.55));
    this.sparkles.setArea(geom.bodyW * 0.35, 12);
    this.view.width = this.w;
    this.view.height = this.h;
    this.source.update();
  }
}

/**
 * Neighborhood little free library on the farm overview.
 * Open shelves, no door. Stays visible when every shelf is empty.
 * The house is the painted front-facing sprite; jars are drawn in the same soft glass style.
 */
export class LittleLibrary {
  readonly root = new Container();
  private readonly house: Sprite;
  private readonly slots: ShelfJar[];
  private readonly lids = new Map<string, Texture>();
  private jars: PublicSharedGoal[] = [];
  private lidToken = 0;
  private readonly w: number;
  private readonly h: number;

  constructor(
    atlas: Atlas,
    texW: number,
    texH: number,
    hit: UvRect,
    houseTexture: Texture,
    onTap: (goalId: string) => void,
    onOverflow: () => void,
  ) {
    const rect = uvRectToLocal(hit, texW, texH);
    this.w = rect.x1 - rect.x0;
    this.h = rect.y1 - rect.y0;
    this.root.position.set(rect.x0, rect.y0);
    this.root.zIndex = 1700;
    this.root.eventMode = "passive";
    this.root.visible = true;
    this.house = new Sprite(houseTexture);
    this.house.eventMode = "none";
    this.house.width = this.w;
    this.house.height = this.h;
    this.slots = Array.from({ length: LIBRARY_JAR_CAPACITY + 1 }, () => new ShelfJar(atlas, onTap, onOverflow));
    this.root.addChild(this.house, ...this.slots.map((slot) => slot.root));
    this.apply();
  }

  setJars(jars: PublicSharedGoal[]) {
    this.jars = jars.filter((jar) => jar.status === "OPEN" || jar.status === "READY");
    this.root.visible = true;
    this.apply();
    void this.syncLids(this.jars);
  }

  update(dt: number, t: number) {
    for (const slot of this.slots) slot.update(dt, t);
  }

  /** Canvas jar textures are not part of the shared painted-art cache. */
  release() {
    for (const slot of this.slots) slot.release();
  }

  private interiorOrigin() {
    return libraryHouseMetrics({ w: this.w, h: this.h }).interior;
  }

  private apply() {
    const windowed = libraryWindow(this.jars);
    const interior = this.interiorOrigin();
    const layout = libraryShelfLayout({ w: interior.w, h: interior.h }, windowed.shown.length, windowed.overflow);
    this.root.visible = layout.visible;
    this.slots.forEach((slot, index) => {
      const frame: LibrarySlot | undefined = layout.slots[index];
      if (!frame) {
        slot.hide();
        return;
      }
      slot.resize(frame.w, frame.h);
      slot.root.position.set(interior.x + frame.x, interior.y + frame.y);
      if (frame.kind === "overflow") slot.setOverflow(windowed.overflow);
      else {
        const jar = windowed.shown[index];
        if (!jar) {
          slot.hide();
          return;
        }
        slot.setJar(jar);
        const tex = jar.artUrl ? this.lids.get(`${jar.id}:${jar.artUrl}`) : undefined;
        if (tex) slot.setLid(tex);
      }
    });
  }

  private async syncLids(jars: PublicSharedGoal[]) {
    const token = ++this.lidToken;
    for (const jar of jars) {
      if (!jar.artUrl || jar.artStatus === "DEFAULT" || jar.artStatus === "FAILED") continue;
      const key = `${jar.id}:${jar.artUrl}`;
      if (this.lids.has(key)) continue;
      try {
        const texture = await Assets.load<Texture>(jar.artUrl);
        if (token !== this.lidToken) return;
        this.lids.set(key, texture);
        this.apply();
      } catch {
        /* emoji cork stays */
      }
    }
  }
}
