import {
  jarTint,
  tubeFillRatio,
  type PublicSharedGoal,
} from "@farmhand/shared";
import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
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
const RED = 0xc24b3e;
const RED_DARK = 0x8a332c;
const RED_ROOF = 0xb13e34;
const CREAM = 0xf7ecd4;
const CREAM_DEEP = 0xecd9b4;
const WOOD = 0xc49262;
const WOOD_DARK = 0x8d5a32;
const CORK = 0xe4c48a;
const STAR = 0xf2c56b;

function hex(color: string) {
  return Number.parseInt(color.slice(1), 16);
}

function drawStar(g: Graphics, cx: number, cy: number, r: number, color: number) {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.42;
    pts.push(cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad);
  }
  g.poly(pts);
  g.fill({ color });
}

/** One mason jar on a shelf, or the +N chip when more goals exist than fit. */
class ShelfJar {
  readonly root = new Container();
  private readonly body = new Graphics();
  private readonly hit = new Graphics();
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
    this.root.addChild(this.hit, this.body, this.sparkles.root, this.lid, this.emoji, this.plus);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.hit.clear();
    this.hit.rect(0, 0, w, h);
    this.hit.fill({ color: 0xffffff, alpha: 0.001 });
    this.root.hitArea = new Rectangle(0, 0, w, h);
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
    }
    const next = tubeFillRatio(jar.filledStars, jar.targetStars);
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

  private draw(ratio: number) {
    const g = this.body;
    g.clear();
    if (this.mode === "overflow") {
      const chipW = this.w * 0.86;
      const chipH = this.h * 0.72;
      const x = (this.w - chipW) / 2;
      const y = (this.h - chipH) / 2;
      g.roundRect(x, y, chipW, chipH, 10);
      g.fill({ color: CREAM });
      g.roundRect(x, y, chipW, chipH, 10);
      g.stroke({ color: WOOD_DARK, width: 3 });
      this.plus.position.set(this.w / 2, this.h / 2);
      this.plus.style.fontSize = Math.max(14, Math.round(this.w * 0.34));
      return;
    }
    if (this.mode !== "jar") return;

    const tint = jarTint(this.tintIndex);
    const clamped = Math.max(0, Math.min(1, ratio));
    const corkH = this.h * 0.16;
    const neckH = this.h * 0.06;
    const bodyTop = corkH + neckH;
    const bodyH = this.h - bodyTop;
    const bodyW = this.w * 0.86;
    const neckW = bodyW * 0.62;
    const x = (this.w - bodyW) / 2;
    const cx = this.w / 2;

    g.roundRect(x, bodyTop, bodyW, bodyH, Math.min(14, bodyW * 0.28));
    g.fill({ color: hex(tint.glass), alpha: 0.9 });

    const pad = Math.max(3, bodyW * 0.1);
    const maxFill = Math.max(0, bodyH - pad * 1.4);
    const fillH = maxFill * clamped;
    if (fillH > 1.2) {
      const fillTop = bodyTop + bodyH - pad * 0.45 - fillH;
      g.roundRect(x + pad, fillTop, bodyW - pad * 2, fillH, Math.min(10, (bodyW - pad * 2) * 0.28));
      g.fill({ color: hex(tint.fill), alpha: 0.94 });
      const starR = Math.max(3, Math.min(bodyW * 0.16, fillH * 0.28));
      drawStar(g, cx, fillTop + fillH * 0.58, starR, 0xfff6d8);
    }

    g.roundRect(x + bodyW * 0.16, bodyTop + bodyH * 0.08, Math.max(2, bodyW * 0.08), bodyH * 0.28, 3);
    g.fill({ color: 0xffffff, alpha: 0.45 });
    g.roundRect(x, bodyTop, bodyW, bodyH, Math.min(14, bodyW * 0.28));
    g.stroke({ color: hex(tint.rim), width: Math.max(2, bodyW * 0.045) });

    const neckX = cx - neckW / 2;
    g.roundRect(neckX, corkH * 0.85, neckW, neckH + 2, 3);
    g.fill({ color: hex(tint.glass), alpha: 0.9 });
    g.roundRect(neckX, corkH * 0.85, neckW, neckH + 2, 3);
    g.stroke({ color: hex(tint.rim), width: 2 });

    const corkW = neckW * 1.05;
    g.roundRect(cx - corkW / 2, 1, corkW, corkH, 4);
    g.fill({ color: CORK });
    g.roundRect(cx - corkW / 2, 1, corkW, corkH * 0.35, 3);
    g.fill({ color: 0xf3ddb0, alpha: 0.9 });

    const badgeR = corkH * 0.72;
    this.emoji.visible = !this.lid.visible;
    this.emoji.style.fontSize = Math.max(10, Math.round(badgeR * 1.5));
    this.emoji.position.set(cx, corkH * 0.55);
    this.lid.position.set(cx, corkH * 0.55);
    this.lid.width = badgeR * 2;
    this.lid.height = badgeR * 2;
    this.sparkles.root.position.set(cx, bodyTop + bodyH * (1 - clamped * 0.55));
    this.sparkles.setArea(bodyW * 0.35, 12);
  }
}

/**
 * Neighborhood little free library on the farm overview.
 * Open shelves, no door. Stays visible when every shelf is empty.
 */
export class LittleLibrary {
  readonly root = new Container();
  private readonly house = new Graphics();
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
    this.slots = Array.from({ length: LIBRARY_JAR_CAPACITY + 1 }, () => new ShelfJar(atlas, onTap, onOverflow));
    this.root.addChild(this.house, ...this.slots.map((slot) => slot.root));
    this.paintHouse();
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

  private interiorOrigin() {
    return libraryHouseMetrics({ w: this.w, h: this.h }).interior;
  }

  private paintHouse() {
    const g = this.house;
    const box = { w: this.w, h: this.h };
    const { body, interior, post, roof, star } = libraryHouseMetrics(box);
    const empty = libraryShelfLayout(interior, 0, 0);
    g.clear();

    g.roundRect(post.x, post.y, post.w, post.h, 5);
    g.fill({ color: WOOD });
    g.roundRect(post.x + post.w * 0.18, post.y + 8, post.w * 0.16, post.h * 0.55, 3);
    g.fill({ color: 0xf0d2a4, alpha: 0.35 });
    g.roundRect(post.x, post.y, post.w, post.h, 5);
    g.stroke({ color: WOOD_DARK, width: 3 });

    const braceW = post.w * 2.1;
    g.roundRect((this.w - braceW) / 2, post.y - 6, braceW, 12, 3);
    g.fill({ color: WOOD_DARK });

    g.roundRect(body.x, body.y, body.w, body.h, 8);
    g.fill({ color: RED });
    g.poly([roof.left, roof.eaveY, roof.apexX, roof.apexY, roof.right, roof.eaveY]);
    g.fill({ color: RED_ROOF });
    g.poly([roof.left, roof.eaveY, roof.apexX, roof.apexY, roof.right, roof.eaveY]);
    g.stroke({ color: RED_DARK, width: 4 });

    g.roundRect(interior.x, interior.y, interior.w, interior.h, 4);
    g.fill({ color: CREAM });
    g.roundRect(interior.x, interior.y, interior.w * 0.08, interior.h, 2);
    g.fill({ color: CREAM_DEEP, alpha: 0.65 });

    for (const shelf of empty.shelves) {
      const boardY = interior.y + shelf.y + shelf.h - 7;
      g.roundRect(interior.x + 2, boardY, interior.w - 4, 8, 2);
      g.fill({ color: WOOD });
      g.rect(interior.x + 2, boardY + 6, interior.w - 4, 2);
      g.fill({ color: WOOD_DARK, alpha: 0.45 });
    }

    g.roundRect(body.x, body.y, body.w, body.h, 8);
    g.stroke({ color: RED_DARK, width: 5 });
    drawStar(g, star.x, star.y, star.r, STAR);
    g.circle(star.x, star.y, star.r * 0.28);
    g.fill({ color: 0xfff6d4, alpha: 0.85 });
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
