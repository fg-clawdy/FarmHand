import {
  SHARED_GOAL_COPY,
  compactJarTitle,
  jarProgressLabel,
  jarTint,
  trayWindow,
  type PublicSharedGoal,
} from "@farmhand/shared";
import { Assets, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import type { Atlas } from "./atlas";
import { SparkleField } from "./fx";
import { jarTraySlots } from "./jarTrayLayout";
import { PLAYFIELD_LAYOUT, uvRectToLocal } from "./playfieldLayout";

const INK = 0x3a2410;
const WOOD = 0x8d5a32;
const CORK = 0xe4c48a;

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

export function familyJarVisible(jar: PublicSharedGoal | null | undefined): jar is PublicSharedGoal {
  return !!jar && (jar.status === "OPEN" || jar.status === "READY");
}

/** One star tube, the overflow chip, or a hidden slot. */
class MiniJar {
  readonly root = new Container();
  private readonly body = new Graphics();
  private readonly hit = new Graphics();
  private readonly title: Text;
  private readonly sub: Text;
  private readonly emoji: Text;
  private readonly plus: Text;
  private readonly lid = new Sprite(Texture.EMPTY);
  private readonly sparkles: SparkleField;
  private w = 40;
  private h = 80;
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
      style: { fontFamily: "Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif", fontSize: 16, align: "center" },
    });
    this.emoji.anchor.set(0.5);

    this.plus = new Text({
      text: "",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 22, fill: INK, fontWeight: "700", align: "center" },
    });
    this.plus.anchor.set(0.5);

    this.title = new Text({
      text: "",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 13,
        fill: INK,
        fontWeight: "700",
        align: "center",
        wordWrap: false,
      },
    });
    this.title.anchor.set(0.5, 0);

    this.sub = new Text({
      text: "",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 12, fill: 0x6b4224, fontWeight: "700", align: "center" },
    });
    this.sub.anchor.set(0.5, 0);

    this.lid.anchor.set(0.5);
    this.lid.visible = false;
    this.sparkles = new SparkleField(atlas, 5);
    this.sparkles.setSoft(true);
    this.root.addChild(this.hit, this.body, this.sparkles.root, this.lid, this.emoji, this.plus, this.title, this.sub);
  }

  resize(w: number, h: number) {
    this.w = w;
    this.h = h;
    const titleSize = Math.max(11, Math.round(Math.min(15, w * 0.2)));
    this.title.style.fontSize = titleSize;
    this.sub.style.fontSize = Math.max(11, titleSize);
    const compact = h < 150;
    this.emoji.style.fontSize = compact ? Math.max(9, Math.round(w * 0.28)) : Math.max(14, Math.round(w * 0.34));
    this.plus.style.fontSize = compact ? Math.max(12, Math.round(w * 0.32)) : Math.max(16, Math.round(w * 0.38));
    this.hit.clear();
    this.hit.rect(0, 0, w, h);
    this.hit.fill({ color: 0xffffff, alpha: 0.001 });
    this.root.hitArea = new Rectangle(0, 0, w, h);
  }

  setJar(jar: PublicSharedGoal) {
    const same = this.jarId === jar.id && this.mode === "jar";
    this.mode = "jar";
    this.root.eventMode = "static";
    this.jarId = jar.id;
    this.tintIndex = jar.tintIndex ?? 0;
    this.ready = jar.status === "READY";
    const next = jar.targetStars > 0 ? Math.min(1, Math.max(0, jar.filledStars / jar.targetStars)) : 0;
    if (!same) this.shown = next;
    this.target = next;
    if (this.shown > this.target) this.shown = this.target;
    this.root.visible = true;
    this.emoji.text = jar.emoji;
    this.emoji.visible = !this.lid.visible;
    this.plus.visible = false;
    this.title.visible = true;
    this.sub.visible = true;
    this.title.text = compactJarTitle(jar.title, 14);
    this.title.style.fill = hex(jarTint(this.tintIndex).rim);
    this.sub.text = jarProgressLabel(jar.filledStars, jar.targetStars, jar.status);
    this.sub.style.fill = this.ready ? 0x2f6b32 : INK;
    this.sparkles.setActive(this.ready);
    this.clearLid();
    this.draw(this.shown);
  }

  setOverflow(count: number) {
    this.mode = "overflow";
    this.root.eventMode = "static";
    this.jarId = null;
    this.root.visible = true;
    this.emoji.visible = false;
    this.plus.visible = true;
    this.plus.text = `+${count}`;
    this.title.visible = false;
    this.sub.visible = false;
    this.sparkles.setActive(false);
    this.clearLid();
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
      this.clearLid();
      this.draw(this.shown);
      return;
    }
    this.lid.texture = texture;
    this.lid.visible = true;
    this.emoji.visible = false;
    this.draw(this.shown);
  }

  private clearLid() {
    this.lid.visible = false;
    this.lid.texture = Texture.EMPTY;
    if (this.mode === "jar") this.emoji.visible = true;
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
    const compact = this.h < 150;
    this.title.visible = this.mode === "jar" && !compact;
    this.sub.visible = this.mode === "jar" && !compact;
    const titleH = Math.max(12, this.title.height || 14);
    const subH = Math.max(11, this.sub.height || 12);
    const labelH = compact ? 0 : titleH + subH + 4;
    const columnH = Math.max(28, this.h - labelH);
    if (this.mode === "overflow") {
      const chipW = Math.min(this.w - 6, 54);
      const chipH = Math.min(columnH * 0.42, 72);
      const x = (this.w - chipW) / 2;
      const y = (columnH - chipH) / 2;
      g.roundRect(x, y, chipW, chipH, 12);
      g.fill({ color: 0xf7edd6, alpha: 0.96 });
      g.roundRect(x, y, chipW, chipH, 12);
      g.stroke({ color: WOOD, width: 3, alpha: 0.85 });
      this.plus.position.set(this.w / 2, y + chipH / 2);
      return;
    }
    if (this.mode !== "jar") return;

    const tint = jarTint(this.tintIndex);
    const clamped = Math.max(0, Math.min(1, ratio));
    const tubeW = compact
      ? Math.max(8, Math.min(this.w * 0.62, 22))
      : Math.max(14, Math.min(this.w * 0.36, columnH * 0.22, 34));
    const badgeR = compact ? Math.max(6, tubeW * 0.48) : Math.max(11, tubeW * 0.72);
    const x = (this.w - tubeW) / 2;
    const glassTop = badgeR * 1.55;
    const glassH = Math.max(24, columnH - glassTop - 2);
    const glassBottom = glassTop + glassH;
    const cx = this.w / 2;

    g.roundRect(x, glassTop, tubeW, glassH, tubeW / 2);
    g.fill({ color: hex(tint.glass), alpha: 0.72 });

    const pad = Math.max(2, tubeW * 0.12);
    const maxFill = Math.max(0, glassH - pad * 2);
    const fillH = maxFill * clamped;
    if (fillH > 1.2) {
      const fillTop = glassBottom - pad - fillH;
      g.roundRect(x + pad, fillTop, tubeW - pad * 2, fillH, (tubeW - pad * 2) / 2);
      g.fill({ color: hex(tint.fill), alpha: 0.96 });
      const starR = Math.max(2.2, tubeW * 0.11);
      const room = fillH - starR * 2;
      const count = room > starR * 5 ? 3 : room > starR * 2.2 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const sy = fillTop + fillH - starR * 1.6 - (count === 1 ? 0 : (i * room) / Math.max(1, count - 1));
        drawStar(g, cx, sy, starR, 0xfff3c4);
      }
      g.roundRect(x + pad, fillTop - 1.5, tubeW - pad * 2, 3, 2);
      g.fill({ color: 0xfff6d2, alpha: 0.9 });
    }

    for (let i = 1; i <= 4; i++) {
      const ty = glassTop + (glassH * i) / 5;
      g.moveTo(x - 4, ty);
      g.lineTo(x + 1, ty);
      g.stroke({ color: 0x6b4224, width: 1.4, alpha: 0.45 });
    }
    g.roundRect(x + tubeW * 0.18, glassTop + 8, 2.4, glassH * 0.28, 2);
    g.fill({ color: 0xffffff, alpha: 0.55 });
    g.roundRect(x, glassTop, tubeW, glassH, tubeW / 2);
    g.stroke({ color: hex(tint.rim), width: 2.5 });

    const corkW = tubeW * 0.72;
    const corkH = Math.max(6, tubeW * 0.28);
    g.roundRect(cx - corkW / 2, glassTop - corkH * 0.55, corkW, corkH, 3);
    g.fill({ color: CORK });
    g.circle(cx, badgeR * 0.95, badgeR);
    g.fill({ color: 0xf8edd4 });
    g.circle(cx, badgeR * 0.95, badgeR);
    g.stroke({ color: hex(tint.rim), width: 2.5 });

    this.emoji.position.set(cx, badgeR * 0.95);
    this.lid.position.set(cx, badgeR * 0.95);
    const icon = badgeR * 1.55;
    this.lid.width = icon;
    this.lid.height = icon;
    this.sparkles.root.position.set(cx, glassTop + glassH * (1 - clamped * 0.65));
    this.sparkles.setArea(tubeW * 0.55, 16);
    this.title.position.set(this.w / 2, columnH);
    this.sub.position.set(this.w / 2, columnH + titleH);
  }
}

/** Wood rack of tall shared-goal tubes. Kid surfaces never show who poured. */
export class FamilyJarTray {
  readonly root = new Container();
  private readonly board = new Graphics();
  private readonly ghost = new Graphics();
  private readonly header: Text;
  private readonly emptyTitle: Text;
  private readonly emptySub: Text;
  private readonly slots: MiniJar[];
  private readonly lids = new Map<string, Texture>();
  private jars: PublicSharedGoal[] = [];
  private lidToken = 0;
  private readonly w: number;
  private readonly h: number;

  constructor(
    atlas: Atlas,
    tw: number,
    th: number,
    onTap: (goalId: string) => void,
    onOverflow: () => void,
  ) {
    const rect = uvRectToLocal(PLAYFIELD_LAYOUT.familyJarHit, tw, th);
    this.w = rect.x1 - rect.x0;
    this.h = rect.y1 - rect.y0;
    this.root.position.set(rect.x0, rect.y0);
    this.root.zIndex = 4200;
    this.root.eventMode = "passive";

    this.header = new Text({
      text: SHARED_GOAL_COPY.trayTitle,
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: Math.max(13, Math.round(this.w * 0.062)),
        fill: INK,
        fontWeight: "700",
        align: "center",
      },
    });
    this.header.anchor.set(0.5, 0);
    this.header.position.set(this.w / 2, 7);
    this.header.visible = false;

    this.emptyTitle = new Text({
      text: SHARED_GOAL_COPY.trayEmpty,
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 15, fill: INK, fontWeight: "700", align: "center" },
    });
    this.emptyTitle.anchor.set(0.5, 0);
    this.emptySub = new Text({
      text: SHARED_GOAL_COPY.trayComing,
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 12, fill: 0x6b4224, align: "center" },
    });
    this.emptySub.anchor.set(0.5, 0);
    this.emptyTitle.visible = false;
    this.emptySub.visible = false;
    this.ghost.visible = false;
    this.root.visible = false;

    this.slots = Array.from({ length: 4 }, () => new MiniJar(atlas, onTap, onOverflow));
    this.root.addChild(
      this.board,
      this.ghost,
      this.header,
      this.emptyTitle,
      this.emptySub,
      ...this.slots.map((slot) => slot.root),
    );
    this.drawBoard();
    this.apply();
  }

  setJars(jars: PublicSharedGoal[]) {
    this.jars = jars.filter(familyJarVisible);
    this.root.visible = this.jars.length > 0;
    if (!this.root.visible) return;
    this.apply();
    void this.syncLids(this.jars);
  }

  update(dt: number, t: number) {
    for (const slot of this.slots) slot.update(dt, t);
  }

  private drawBoard() {
    const g = this.board;
    const { w, h } = this;
    const r = Math.min(12, Math.round(Math.min(w, h) * 0.12));
    g.clear();
    g.roundRect(0, 0, w, h, r);
    g.fill({ color: 0x6b3e24 });
    g.roundRect(3, 3, w - 6, h - 6, Math.max(6, r - 2));
    g.fill({ color: 0xf4e6c4 });
  }

  private apply() {
    const windowed = trayWindow(this.jars);
    const frames = jarTraySlots({ w: this.w, h: this.h }, windowed.shown.length, windowed.overflow);
    const empty = windowed.shown.length === 0;
    this.root.visible = !empty;
    this.ghost.visible = false;
    this.emptyTitle.visible = false;
    this.emptySub.visible = false;
    if (empty) {
      for (const slot of this.slots) slot.hide();
      return;
    }
    this.slots.forEach((slot, index) => {
      const frame = frames.slots[index];
      const jar = windowed.shown[index];
      if (!frame || frame.kind === "ghost") {
        slot.hide();
        return;
      }
      slot.resize(frame.w, frame.h);
      slot.root.position.set(frame.x, frame.y);
      if (frame.kind === "overflow") slot.setOverflow(windowed.overflow);
      else if (jar) {
        slot.setJar(jar);
        const tex = jar.artUrl ? this.lids.get(`${jar.id}:${jar.artUrl}`) : undefined;
        if (tex) slot.setLid(tex);
      } else slot.hide();
    });
  }

  private async syncLids(jars: PublicSharedGoal[]) {
    const token = ++this.lidToken;
    for (const jar of jars) {
      if (!jar.artUrl) continue;
      const key = `${jar.id}:${jar.artUrl}`;
      const cached = this.lids.get(key);
      if (cached) continue;
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
