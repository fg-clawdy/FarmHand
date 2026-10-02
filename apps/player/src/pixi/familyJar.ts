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

export function familyJarVisible(jar: PublicSharedGoal | null | undefined): jar is PublicSharedGoal {
  return !!jar && (jar.status === "OPEN" || jar.status === "READY");
}

/** One mini jar, the overflow chip, or a hidden slot. */
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
        wordWrap: true,
        wordWrapWidth: 60,
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
    const titleSize = Math.max(11, Math.round(w * 0.2));
    this.title.style.fontSize = titleSize;
    this.title.style.wordWrapWidth = Math.max(20, w - 2);
    this.sub.style.fontSize = Math.max(10, titleSize - 1);
    this.emoji.style.fontSize = Math.max(14, Math.round(w * 0.34));
    this.plus.style.fontSize = Math.max(16, Math.round(w * 0.38));
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
    const next = jar.targetStars > 0 ? Math.min(1, jar.filledStars / jar.targetStars) : 0;
    if (!same) this.shown = next;
    this.target = next;
    this.root.visible = true;
    this.emoji.text = jar.emoji;
    this.emoji.visible = !this.lid.visible;
    this.plus.visible = false;
    this.title.visible = true;
    this.sub.visible = true;
    this.title.text = compactJarTitle(jar.title, 11);
    this.sub.text = jarProgressLabel(jar.filledStars, jar.targetStars, jar.status);
    this.sub.style.fill = this.ready ? 0x2f6b32 : 0x6b4224;
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
    else this.shown += Math.sign(delta) * Math.min(Math.abs(delta), dt / 0.3);
    this.draw(this.shown);
    this.sparkles.update(t);
  }

  private draw(ratio: number) {
    const g = this.body;
    g.clear();
    const labelH = Math.min(42, this.h * 0.34);
    const jarH = Math.max(24, this.h - labelH);
    const jarW = Math.min(this.w - 2, jarH * 0.72);
    const x = (this.w - jarW) / 2;
    const y = 2;
    if (this.mode === "overflow") {
      g.roundRect(2, 8, this.w - 4, jarH - 8, 14);
      g.fill({ color: 0xf7edd6, alpha: 0.96 });
      g.roundRect(2, 8, this.w - 4, jarH - 8, 14);
      g.stroke({ color: WOOD, width: 3, alpha: 0.85 });
      this.plus.position.set(this.w / 2, 8 + (jarH - 8) / 2);
      return;
    }
    if (this.mode !== "jar") return;

    const tint = jarTint(this.tintIndex);
    const lidH = Math.max(14, jarW * 0.32);
    const glassY = y + lidH * 0.62;
    const glassH = jarH - lidH * 0.5;
    g.roundRect(x, glassY, jarW, glassH, jarW * 0.32);
    g.fill({ color: hex(tint.glass), alpha: 0.92 });
    const maxFill = Math.max(0, glassH - 8);
    const fillH = Math.max(0, Math.min(maxFill, maxFill * ratio));
    if (fillH > 1.5) {
      g.roundRect(x + 4, glassY + glassH - 4 - fillH, jarW - 8, fillH, 7);
      g.fill({ color: hex(tint.fill), alpha: 0.95 });
    }
    g.roundRect(x + jarW * 0.16, glassY + 6, 3, glassH * 0.38, 2);
    g.fill({ color: 0xffffff, alpha: 0.45 });
    g.roundRect(x, glassY, jarW, glassH, jarW * 0.32);
    g.stroke({ color: hex(tint.rim), width: 3 });
    g.roundRect(x - 1, y, jarW + 2, lidH, lidH / 2);
    g.fill({ color: CORK });
    g.roundRect(x - 1, y, jarW + 2, lidH, lidH / 2);
    g.stroke({ color: 0x8a6238, width: 2 });
    const cx = x + jarW / 2;
    const cy = y + lidH / 2;
    if (!this.lid.visible) {
      g.circle(cx, cy, lidH * 0.34);
      g.fill({ color: 0xf8edd4 });
    }
    this.emoji.position.set(cx, cy);
    this.lid.position.set(cx, cy);
    const icon = lidH * 0.86;
    this.lid.width = icon;
    this.lid.height = icon;
    this.sparkles.root.position.set(cx, glassY + glassH * 0.55);
    this.sparkles.setArea(jarW * 0.32, glassH * 0.2);
    this.title.position.set(this.w / 2, jarH + 1);
    this.sub.position.set(this.w / 2, jarH + 2 + (this.title.height || 14));
  }
}

/** Wood tray of mini shared-goal jars. Kid surfaces never show who poured. */
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
        fontSize: Math.max(14, Math.round(this.w * 0.075)),
        fill: INK,
        fontWeight: "700",
        align: "center",
      },
    });
    this.header.anchor.set(0.5, 0);
    this.header.position.set(this.w / 2, 7);

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
    this.apply();
    void this.syncLids(this.jars);
  }

  update(dt: number, t: number) {
    for (const slot of this.slots) slot.update(dt, t);
  }

  private drawBoard() {
    const g = this.board;
    const { w, h } = this;
    g.clear();
    g.roundRect(0, 0, w, h, 18);
    g.fill({ color: 0x6e4124 });
    g.roundRect(4, 4, w - 8, h - 8, 15);
    g.fill({ color: 0xc4925a });
    g.roundRect(8, 8, w - 16, h - 16, 12);
    g.fill({ color: 0xe6c48a });
    g.moveTo(16, 26);
    g.lineTo(w - 16, 26);
    g.stroke({ color: WOOD, width: 2, alpha: 0.28 });
    for (const [x, y] of [
      [16, 16],
      [w - 16, 16],
      [16, h - 16],
      [w - 16, h - 16],
    ] as const) {
      g.circle(x, y, 3.2);
      g.fill({ color: 0x5c3a22 });
    }
  }

  private apply() {
    const windowed = trayWindow(this.jars);
    const frames = jarTraySlots({ w: this.w, h: this.h }, windowed.shown.length, windowed.overflow);
    const empty = windowed.shown.length === 0;
    this.ghost.visible = empty;
    this.emptyTitle.visible = empty;
    this.emptySub.visible = empty;
    this.ghost.clear();
    if (empty && frames.slots[0]) {
      const frame = frames.slots[0];
      const jarW = frame.w * 0.7;
      const jarH = frame.h * 0.55;
      const x = frame.x + (frame.w - jarW) / 2;
      const y = frame.y;
      this.ghost.roundRect(x, y + 10, jarW, jarH, 16);
      this.ghost.stroke({ color: WOOD, width: 3, alpha: 0.4 });
      this.ghost.circle(x + jarW / 2, y + 18, 8);
      this.ghost.stroke({ color: WOOD, width: 2, alpha: 0.35 });
      this.emptyTitle.position.set(this.w / 2, y + jarH + 16);
      this.emptySub.position.set(this.w / 2, y + jarH + 34);
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
