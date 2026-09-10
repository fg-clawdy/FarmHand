import { clampJobBoardPosterDwell, DEFAULT_GAME_CONFIG } from "@farmhand/shared";
import { Container, Graphics, Sprite, Text } from "pixi.js";
import { CORKBOARD_HANG, WANTED_POSTER_PAPER_INSET, type PaintedArt } from "./paintedAssets";
import { PLAYFIELD_LAYOUT, uvRectToLocal } from "./playfieldLayout";

export type WantedJob = {
  id: string;
  title: string;
  emoji: string;
  priority: string;
};

/** Placeholder chores so the board has a Wanted poster before Game Engineer wires `/api/farm/jobs`. */
export const PLACEHOLDER_WANTED_JOBS: WantedJob[] = [
  { id: "placeholder-dishes", title: "Dishes", emoji: "🍽️", priority: "NORMAL" },
  { id: "placeholder-dog", title: "Walk the dog", emoji: "🐕", priority: "CRITICAL" },
];

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Sheet cells: 0 pinned paper, 1 tearing paper, 2 empty cork (unused), 3 pinning paper. */
const WANTED_FRAME = { pinned: 0, tearing: 1, pinning: 3 } as const;

/**
 * Ground stake Job Board: standing corkboard stays planted; only the paper
 * poster tears and pins. Game Engineer hooks `onOpen` + `setJobs`.
 */
export class CorkboardHotspot {
  readonly root = new Container();
  private readonly board: Sprite;
  private readonly poster = new Sprite();
  private readonly copy = new Container();
  private readonly emojiText: Text;
  private readonly titleText: Text;
  private readonly chipText: Text;
  private jobs: WantedJob[] = PLACEHOLDER_WANTED_JOBS;
  private index = 0;
  private phase: "show" | "tear" | "pin" = "show";
  private phaseT = 0;
  private dwellSeconds = DEFAULT_GAME_CONFIG.jobBoardPosterDwellSeconds;
  private restX = 0;
  private restY = 0;
  private baseScale = 1;
  private frames: PaintedArt["wantedPosterFrames"];

  constructor(painted: PaintedArt, texW: number, texH: number, onOpen: () => void) {
    const rect = uvRectToLocal(PLAYFIELD_LAYOUT.jobBoardHit, texW, texH);
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    this.root.position.set(rect.x0, rect.y0);
    this.frames = painted.wantedPosterFrames;

    // Standing corkboard with posts — anchor bottom-center, feet at bottom of hit rect.
    this.board = new Sprite(painted.corkboard);
    this.board.anchor.set(0.5, 1);
    const artW = painted.corkboard.width || 721;
    const artH = painted.corkboard.height || 814;
    const boardScale = Math.min(w / artW, h / artH);
    this.board.scale.set(boardScale);
    this.board.position.set(w / 2, h);

    // Paper-only poster nested on the cork face (not the posts).
    this.poster.anchor.set(0.5);
    this.poster.texture = this.frames[WANTED_FRAME.pinned] ?? painted.corkboard;
    const posterH = this.poster.texture.height || WANTED_POSTER_PAPER_INSET.h;
    const posterW = this.poster.texture.width || WANTED_POSTER_PAPER_INSET.w;
    const faceW = CORKBOARD_HANG.w * boardScale;
    const faceH = CORKBOARD_HANG.h * boardScale;
    this.baseScale = Math.min((faceW * 0.72) / posterW, (faceH * 0.78) / posterH);
    const faceCenterFromBottom = (artH - (CORKBOARD_HANG.y + CORKBOARD_HANG.h / 2)) * boardScale;
    this.restX = w / 2;
    this.restY = h - faceCenterFromBottom;
    this.poster.scale.set(this.baseScale);
    this.poster.position.set(this.restX, this.restY);

    const typeScale = 1 / Math.max(0.2, this.baseScale);
    this.emojiText = new Text({
      text: "📌",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 22 * typeScale, fill: 0x3a2410, align: "center" },
    });
    this.emojiText.anchor.set(0.5, 0);
    this.titleText = new Text({
      text: "Open jobs",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 13 * typeScale,
        fill: 0x3a2410,
        fontWeight: "700",
        wordWrap: true,
        wordWrapWidth: Math.max(64, posterW * 0.55),
        align: "center",
      },
    });
    this.titleText.anchor.set(0.5, 0);
    this.chipText = new Text({
      text: "+1 waiting seed",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 10 * typeScale,
        fill: 0x5c3218,
        fontWeight: "700",
        align: "center",
      },
    });
    this.chipText.anchor.set(0.5, 0);
    this.copy.addChild(this.emojiText, this.titleText, this.chipText);
    this.poster.addChild(this.copy);

    const label = new Text({
      text: "Job Board",
      style: {
        fontFamily: "Fredoka, sans-serif",
        fontSize: 22,
        fill: 0xfff8ec,
        fontWeight: "700",
        stroke: { color: 0x3a2410, width: 5 },
      },
    });
    label.anchor.set(0.5, 1);
    label.position.set(w / 2, 0);

    const hit = new Graphics();
    hit.rect(0, 0, w, h);
    hit.fill({ color: 0xffffff, alpha: 0.001 });

    this.root.addChild(this.board, this.poster, label, hit);
    this.root.zIndex = 4200;
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerup", onOpen);
    this.paintPoster(this.jobs[0] ?? null);
  }

  setJobs(jobs: WantedJob[], dwellSeconds?: number) {
    if (dwellSeconds != null) this.dwellSeconds = clampJobBoardPosterDwell(dwellSeconds);
    const next = jobs.length ? jobs : PLACEHOLDER_WANTED_JOBS;
    const same = next.length === this.jobs.length && next.every((job, i) => job.id === this.jobs[i]?.id);
    this.jobs = next;
    if (!same) {
      this.index = 0;
      this.phase = "show";
      this.phaseT = 0;
      this.resetPosterPose();
      this.paintPoster(this.jobs[0] ?? null);
    }
  }

  setPosterDwellSeconds(seconds: number) {
    this.dwellSeconds = clampJobBoardPosterDwell(seconds);
  }

  update(dt: number) {
    if (this.jobs.length < 2) {
      this.resetPosterPose();
      this.setFrame(WANTED_FRAME.pinned);
      return;
    }
    this.phaseT += dt;
    if (this.phase === "show") {
      this.resetPosterPose();
      this.setFrame(WANTED_FRAME.pinned);
      if (this.phaseT >= this.dwellSeconds) {
        this.phase = "tear";
        this.phaseT = 0;
      }
      return;
    }
    if (this.phase === "tear") {
      const p = Math.min(1, this.phaseT / 0.5);
      // Paper only — never swap to cell 2 (empty cork plate).
      this.setFrame(WANTED_FRAME.tearing);
      this.poster.rotation = p * 0.45;
      this.poster.position.set(this.restX + p * 22, this.restY + p * 48);
      this.poster.alpha = 1 - p * 0.85;
      this.copy.visible = p < 0.55;
      if (p >= 1) {
        this.index = (this.index + 1) % this.jobs.length;
        this.paintPoster(this.jobs[this.index] ?? null);
        this.phase = "pin";
        this.phaseT = 0;
        this.poster.rotation = -0.08;
        this.poster.position.set(this.restX, this.restY - 10);
        this.poster.alpha = 1;
        this.poster.scale.set(this.baseScale * 0.35);
        this.setFrame(WANTED_FRAME.pinning);
        this.copy.visible = true;
      }
      return;
    }
    const p = Math.min(1, this.phaseT / 0.45);
    const eased = easeOutBack(p);
    this.poster.scale.set(this.baseScale * (0.35 + 0.65 * eased));
    this.poster.rotation = -0.08 * (1 - p);
    this.poster.position.set(this.restX, this.restY - 10 * (1 - p));
    this.poster.alpha = 1;
    this.setFrame(p < 0.5 ? WANTED_FRAME.pinning : WANTED_FRAME.pinned);
    if (p >= 1) {
      this.phase = "show";
      this.phaseT = 0;
      this.resetPosterPose();
    }
  }

  debugHit(texW: number, texH: number) {
    const uv = PLAYFIELD_LAYOUT.jobBoardHit;
    const local = uvRectToLocal(uv, texW, texH);
    return {
      uv,
      local,
      zIndex: this.root.zIndex,
      job: this.jobs[this.index] ?? null,
      phase: this.phase,
    };
  }

  private setFrame(i: number) {
    const frame = this.frames[i] ?? this.frames[0];
    if (frame && this.poster.texture !== frame) this.poster.texture = frame;
  }

  private resetPosterPose() {
    this.poster.rotation = 0;
    this.poster.alpha = 1;
    this.poster.scale.set(this.baseScale);
    this.poster.position.set(this.restX, this.restY);
    this.copy.visible = true;
  }

  private paintPoster(job: WantedJob | null) {
    const critical = job?.priority === "CRITICAL";
    this.poster.tint = critical ? 0xffd0c4 : 0xffffff;
    this.emojiText.text = job?.emoji || "📌";
    this.emojiText.position.set(0, -8);
    this.titleText.text = job?.title || "No open jobs";
    this.titleText.position.set(0, 48);
    this.chipText.text = job ? "+1 waiting seed" : "Check back soon";
    this.chipText.position.set(0, 110);
    this.setFrame(WANTED_FRAME.pinned);
  }
}
