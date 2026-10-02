import type { PublicSharedGoal } from "@farmhand/shared";
import { Container, Graphics, Text } from "pixi.js";
import type { Atlas } from "./atlas";
import { SparkleField } from "./fx";
import { PLAYFIELD_LAYOUT, uvRectToLocal } from "./playfieldLayout";

const FILL = 0xf0a12a;
const GLASS = 0xd7eef8;
const WOOD = 0x6b3e1f;
const INK = 0x3a2410;

export function familyJarVisible(jar: PublicSharedGoal | null | undefined): jar is PublicSharedGoal {
  return !!jar && (jar.status === "OPEN" || jar.status === "READY");
}

/** One shared jar on the playfield. No names, no percent, no donor marks. */
export class FamilyJarHotspot {
  readonly root = new Container();
  private readonly body = new Graphics();
  private readonly title: Text;
  private readonly count: Text;
  private readonly sparkles: SparkleField;
  private shown = 0;
  private target = 0;
  private status: PublicSharedGoal["status"] | null = null;
  private jarId: string | null = null;
  private readonly w: number;
  private readonly h: number;
  private readonly inner: { x: number; y: number; w: number; h: number };

  constructor(atlas: Atlas, tw: number, th: number, onTap: () => void) {
    const rect = uvRectToLocal(PLAYFIELD_LAYOUT.familyJarHit, tw, th);
    this.w = rect.x1 - rect.x0;
    this.h = rect.y1 - rect.y0;
    this.root.position.set(rect.x0, rect.y0);
    this.root.zIndex = 4200;
    this.root.visible = false;
    this.root.eventMode = "none";

    const hit = new Graphics();
    hit.rect(0, 0, this.w, this.h);
    hit.fill({ color: 0xffffff, alpha: 0.001 });
    hit.eventMode = "static";
    hit.cursor = "pointer";
    hit.on("pointerup", (event) => {
      event.stopPropagation();
      onTap();
    });

    const font = Math.max(16, Math.round(this.w * 0.1));
    this.title = new Text({
      text: "Family jar",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: font,
        fill: 0xfff8ec,
        fontWeight: "700",
        stroke: { color: INK, width: 4 },
        align: "center",
        wordWrap: true,
        wordWrapWidth: this.w - 6,
      },
    });
    this.title.anchor.set(0.5, 0);
    this.title.position.set(this.w / 2, 0);

    this.count = new Text({
      text: "",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: Math.max(14, font - 2),
        fill: 0xfff8ec,
        fontWeight: "700",
        stroke: { color: INK, width: 3 },
        align: "center",
      },
    });
    this.count.anchor.set(0.5, 1);
    this.count.position.set(this.w / 2, this.h - 2);

    this.sparkles = new SparkleField(atlas, 8);
    this.sparkles.root.position.set(this.w / 2, this.h * 0.46);
    this.sparkles.setArea(this.w * 0.26, this.h * 0.2);

    const top = font * 2.4;
    const bottom = 28;
    this.inner = {
      x: this.w * 0.22,
      y: top,
      w: this.w * 0.56,
      h: Math.max(40, this.h - top - bottom),
    };

    this.root.addChild(hit, this.body, this.sparkles.root, this.title, this.count);
    this.draw(0);
  }

  setJar(jar: PublicSharedGoal | null) {
    if (!familyJarVisible(jar)) {
      this.root.visible = false;
      this.root.eventMode = "none";
      this.sparkles.setActive(false);
      this.status = null;
      this.jarId = null;
      return;
    }
    const same = this.jarId === jar.id;
    this.jarId = jar.id;
    const next = jar.targetStars > 0 ? Math.min(1, jar.filledStars / jar.targetStars) : 0;
    if (!same) this.shown = next;
    this.target = next;
    this.status = jar.status;
    this.root.visible = true;
    this.root.eventMode = "static";
    const short = jar.title.length > 18 ? `${jar.title.slice(0, 17)}…` : jar.title;
    this.title.text = `${jar.emoji} ${short}\n${jar.status === "READY" ? "Ready" : "Family jar"}`;
    this.count.text = `${jar.filledStars}★`;
    this.sparkles.setActive(jar.status === "READY");
    this.draw(this.shown);
  }

  update(dt: number, t: number) {
    if (!this.root.visible) return;
    const delta = this.target - this.shown;
    if (Math.abs(delta) < 0.002) this.shown = this.target;
    else this.shown += Math.sign(delta) * Math.min(Math.abs(delta), dt / 0.3);
    this.draw(this.shown);
    this.sparkles.update(t);
  }

  private draw(ratio: number) {
    const { x, y, w, h } = this.inner;
    const fillH = Math.max(0, Math.min(h - 8, (h - 8) * ratio));
    this.body.clear();
    this.body.roundRect(8, this.h - 18, this.w - 16, 12, 4);
    this.body.fill({ color: WOOD });
    this.body.roundRect(x, y, w, h, 12);
    this.body.fill({ color: GLASS, alpha: 0.55 });
    this.body.roundRect(x, y, w, h, 12);
    this.body.stroke({ color: WOOD, width: 4 });
    if (fillH > 1) {
      this.body.roundRect(x + 5, y + h - 4 - fillH, w - 10, fillH, 6);
      this.body.fill({ color: FILL, alpha: 0.92 });
    }
    this.body.roundRect(x - 6, y - 10, w + 12, 14, 4);
    this.body.fill({ color: this.status === "READY" ? 0xc47a10 : WOOD });
  }
}
