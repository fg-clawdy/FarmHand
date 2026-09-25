import { clampJobBoardPosterDwell, DEFAULT_GAME_CONFIG, formatJobBoardReward, JOB_BOARD_V1_REWARD_SEED_COUNT } from "@farmhand/shared";
import { Assets, Container, Graphics, Mesh, MeshGeometry, Sprite, Text, Texture } from "pixi.js";
import { CORKBOARD_HANG, WANTED_POSTER_PAPER_INSET, type PaintedArt } from "./paintedAssets";
import { PLAYFIELD_LAYOUT, uvRectToLocal } from "./playfieldLayout";

export type WantedJob = {
  id: string;
  slug?: string;
  flyerUrl?: string | null;
  title: string;
  emoji: string;
  priority: string;
  rewardSeedCount?: number;
  rewardSeedKind?: "seed" | "super_seed";
  rewardLabel?: string;
};

/** Placeholder chores so Farm QA can preview the board without `/api/farm/jobs`. */
export const PLACEHOLDER_WANTED_JOBS: WantedJob[] = [
  {
    id: "placeholder-dishes",
    slug: "dishes-1-6",
    title: "Dishes",
    emoji: "🍽️",
    priority: "NORMAL",
    rewardSeedCount: JOB_BOARD_V1_REWARD_SEED_COUNT,
  },
  {
    id: "placeholder-dog",
    slug: "walk-the-dog",
    title: "Walk the dog",
    emoji: "🐕",
    priority: "CRITICAL",
    rewardSeedCount: JOB_BOARD_V1_REWARD_SEED_COUNT,
  },
];

function easeOutBack(t: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Sheet cells: 0 pinned paper, 1 tearing paper, 2 empty (unused), 3 pinning paper. */
const WANTED_FRAME = { pinned: 0, tearing: 1, pinning: 3 } as const;

/** Nested fit: chore flyer fills most of the cork face, not the posts. */
const FLYER_FACE_FIT = { w: 0.88, h: 0.86 } as const;
const SHEET_FACE_FIT = { w: 0.72, h: 0.78 } as const;

/**
 * Cork face inner rails on corkboard.png (721×814).
 * Top and bottom rails share the same L→R drop (~0.095) so they stay parallel —
 * matching clawdy markup: flyer top ∥ board top (red), flyer bottom ∥ board bottom (blue),
 * sides ∥ posts (green). Resting flyers map onto an inset of this parallelogram.
 */
const CORK_FACE_PINS = {
  // Parallelogram: same dy on top and bottom rails (was flat bottom → horizontal flyer edge).
  tl: { x: 118.0, y: 108.0 },
  tr: { x: 612.0, y: 155.0 }, // dy 47 over dx 494 → ~0.095
  br: { x: 598.0, y: 520.0 }, // dy 47 from bl — matches top rail angle
  bl: { x: 120.0, y: 473.0 },
} as const;

function lerp2(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** corkboard.png pixel → CorkboardHotspot root local (board anchor 0.5, 1). */
function corkPixelToLocal(
  px: number,
  py: number,
  boardX: number,
  boardY: number,
  boardScale: number,
  artW: number,
  artH: number,
) {
  return {
    x: boardX + (px - artW / 2) * boardScale,
    y: boardY + (py - artH) * boardScale,
  };
}

function flyerUrlFor(job: WantedJob | null): string | null {
  if (!job) return null;
  if (job.flyerUrl) return job.flyerUrl;
  if (job.slug) return `/api/media/wanted/${job.slug}.png`;
  return null;
}

function fitScale(faceW: number, faceH: number, texW: number, texH: number, fit: { w: number; h: number }) {
  const w = Math.max(1, texW);
  const h = Math.max(1, texH);
  return Math.min((faceW * fit.w) / w, (faceH * fit.h) / h);
}

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
  private readonly rewardText: Text;
  private jobs: WantedJob[] = PLACEHOLDER_WANTED_JOBS;
  private index = 0;
  private phase: "show" | "tear" | "pin" = "show";
  private phaseT = 0;
  private dwellSeconds = DEFAULT_GAME_CONFIG.jobBoardPosterDwellSeconds;
  private restX = 0;
  private restY = 0;
  /** Scale for sheet tear/pin frames (paper inset size). */
  private sheetScale = 1;
  /** Scale for the active chore flyer (full PNG). Recalculated per texture. */
  private flyerScale = 1;
  private faceW = 1;
  private faceH = 1;
  private frames: PaintedArt["wantedPosterFrames"];
  private flyerById = new Map<string, Texture>();
  private activeFlyer: Texture | null = null;
  private loadToken = 0;
  private readonly flyerMesh: Mesh;
  private readonly flyerGeometry: MeshGeometry;
  private boardScale = 1;
  private artW = 721;
  private artH = 814;

  constructor(painted: PaintedArt, texW: number, texH: number, onOpen: () => void) {
    const rect = uvRectToLocal(PLAYFIELD_LAYOUT.jobBoardHit, texW, texH);
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    this.root.position.set(rect.x0, rect.y0);
    this.frames = painted.wantedPosterFrames;

    this.board = new Sprite(painted.corkboard);
    this.board.anchor.set(0.5, 1);
    const artW = painted.corkboard.width || 721;
    const artH = painted.corkboard.height || 814;
    const boardScale = Math.min(w / artW, h / artH);
    this.board.scale.set(boardScale);
    this.board.position.set(w / 2, h);
    this.boardScale = boardScale;
    this.artW = artW;
    this.artH = artH;

    this.poster.anchor.set(0.5);
    this.poster.texture = this.frames[WANTED_FRAME.pinned] ?? painted.corkboard;
    const sheetH = this.poster.texture.height || WANTED_POSTER_PAPER_INSET.h;
    const sheetW = this.poster.texture.width || WANTED_POSTER_PAPER_INSET.w;
    this.faceW = CORKBOARD_HANG.w * boardScale;
    this.faceH = CORKBOARD_HANG.h * boardScale;
    this.sheetScale = fitScale(this.faceW, this.faceH, sheetW, sheetH, SHEET_FACE_FIT);
    this.flyerScale = this.sheetScale;
    const faceCenterFromBottom = (artH - (CORKBOARD_HANG.y + CORKBOARD_HANG.h / 2)) * boardScale;
    this.restX = w / 2;
    this.restY = h - faceCenterFromBottom;
    this.poster.scale.set(this.poseScale());
    this.poster.position.set(this.restX, this.restY);

    const typeScale = 1 / Math.max(0.2, this.sheetScale);
    this.emojiText = new Text({
      text: "",
      style: { fontFamily: "Fredoka, sans-serif", fontSize: 30 * typeScale, fill: 0x3a2410, align: "center" },
    });
    this.emojiText.anchor.set(0.5);
    this.rewardText = new Text({
      text: "Check back soon",
      style: {
        fontFamily: "Georgia, 'Times New Roman', Fredoka, serif",
        fontSize: 11 * typeScale,
        fill: 0x3a1808,
        fontWeight: "700",
        wordWrap: true,
        wordWrapWidth: Math.max(72, sheetW * 0.78),
        align: "center",
      },
    });
    this.rewardText.anchor.set(0.5, 0);
    this.copy.addChild(this.emojiText, this.rewardText);
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

    this.flyerGeometry = new MeshGeometry({
      positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
    });
    this.flyerMesh = new Mesh({
      geometry: this.flyerGeometry,
      texture: Texture.EMPTY,
    });
    this.flyerMesh.visible = false;

    this.root.addChild(this.board, this.poster, this.flyerMesh, label, hit);
    this.root.zIndex = 4200;
    this.root.eventMode = "static";
    this.root.cursor = "pointer";
    this.root.on("pointerup", onOpen);
    void this.paintPoster(this.jobs[0] ?? null);
  }

  /** Resting pose uses flyer scale when a chore flyer is up; tear/pin use sheet scale. */
  private poseScale() {
    return this.activeFlyer && this.phase === "show" ? this.flyerScale : this.sheetScale;
  }

  private setFlyerScaleFrom(tex: Texture) {
    this.flyerScale = fitScale(
      this.faceW,
      this.faceH,
      tex.width || WANTED_POSTER_PAPER_INSET.w,
      tex.height || WANTED_POSTER_PAPER_INSET.h,
      FLYER_FACE_FIT,
    );
  }

  setJobs(jobs: WantedJob[], dwellSeconds?: number) {
    if (dwellSeconds != null) this.dwellSeconds = clampJobBoardPosterDwell(dwellSeconds);
    const next = jobs;
    const same = next.length === this.jobs.length && next.every((job, i) => job.id === this.jobs[i]?.id);
    this.jobs = next;
    if (!same) {
      this.index = 0;
      this.phase = "show";
      this.phaseT = 0;
      this.resetPosterPose();
      void this.paintPoster(this.jobs[0] ?? null);
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
      // Sheet frames + sheetScale during tear (flyer scale only while phase === "show").
      this.flyerMesh.visible = false;
      this.poster.visible = true;
      this.poster.skew.set(0, 0);
      this.setFrame(WANTED_FRAME.tearing);
      this.poster.scale.set(this.sheetScale);
      this.poster.rotation = p * 0.45;
      this.poster.position.set(this.restX + p * 22, this.restY + p * 48);
      this.poster.alpha = 1 - p * 0.85;
      this.copy.visible = false;
      if (p >= 1) {
        this.index = (this.index + 1) % this.jobs.length;
        void this.paintPoster(this.jobs[this.index] ?? null);
        this.phase = "pin";
        this.phaseT = 0;
        this.poster.rotation = -0.08;
        this.poster.position.set(this.restX, this.restY - 10);
        this.poster.alpha = 1;
        this.poster.scale.set(this.sheetScale * 0.35);
        this.setFrame(WANTED_FRAME.pinning);
        this.copy.visible = false;
      }
      return;
    }
    const p = Math.min(1, this.phaseT / 0.45);
    const eased = easeOutBack(p);
    this.flyerMesh.visible = false;
    this.poster.visible = true;
    this.poster.scale.set(this.sheetScale * (0.35 + 0.65 * eased));
    this.poster.rotation = -0.08 * (1 - p);
    this.poster.position.set(this.restX, this.restY - 10 * (1 - p));
    this.poster.alpha = 1;
    this.setFrame(p < 0.5 ? WANTED_FRAME.pinning : WANTED_FRAME.pinned);
    if (p >= 1) {
      this.phase = "show";
      this.phaseT = 0;
      // Restore flyer for the newly pinned job (paintPoster already set activeFlyer).
      this.resetPosterPose();
      this.setFrame(WANTED_FRAME.pinned);
    }
  }

  /** Chore currently shown on the Wanted flyer (Farm stake tap target). */
  getCurrentJob(): WantedJob | null {
    return this.jobs[this.index] ?? null;
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
      flyerScale: this.flyerScale,
      sheetScale: this.sheetScale,
    };
  }

  private setFrame(i: number) {
    if (i === WANTED_FRAME.pinned && this.activeFlyer && this.phase === "show") {
      if (this.poster.texture !== this.activeFlyer) this.poster.texture = this.activeFlyer;
      return;
    }
    const frame = this.frames[i] ?? this.frames[0];
    if (frame && this.poster.texture !== frame) this.poster.texture = frame;
  }

  /**
   * Inset of CORK_FACE_PINS in root-local space.
   * Top edge stays on the top rail (red); bottom edge on the bottom rail (blue);
   * sides stay on the post-parallel edges (green).
   */
  private flyerCornersLocal() {
    const toLocal = (p: { x: number; y: number }) =>
      corkPixelToLocal(p.x, p.y, this.board.position.x, this.board.position.y, this.boardScale, this.artW, this.artH);
    const TL = toLocal(CORK_FACE_PINS.tl);
    const TR = toLocal(CORK_FACE_PINS.tr);
    const BR = toLocal(CORK_FACE_PINS.br);
    const BL = toLocal(CORK_FACE_PINS.bl);
    const u0 = (1 - FLYER_FACE_FIT.w) / 2;
    const u1 = 1 - u0;
    const v0 = (1 - FLYER_FACE_FIT.h) / 2;
    const v1 = 1 - v0;
    // Sample along rails first so inset top ∥ top rail and inset bottom ∥ bottom rail.
    const topL = lerp2(TL, TR, u0);
    const topR = lerp2(TL, TR, u1);
    const botL = lerp2(BL, BR, u0);
    const botR = lerp2(BL, BR, u1);
    return [
      lerp2(topL, botL, v0),
      lerp2(topR, botR, v0),
      lerp2(topR, botR, v1),
      lerp2(topL, botL, v1),
    ] as const;
  }

  private applyFlyerCorners(
    tl: { x: number; y: number },
    tr: { x: number; y: number },
    br: { x: number; y: number },
    bl: { x: number; y: number },
  ) {
    const pos = this.flyerGeometry.positions;
    pos[0] = tl.x;
    pos[1] = tl.y;
    pos[2] = tr.x;
    pos[3] = tr.y;
    pos[4] = br.x;
    pos[5] = br.y;
    pos[6] = bl.x;
    pos[7] = bl.y;
    // Reassign so Pixi marks the buffer dirty.
    this.flyerGeometry.positions = pos;
  }

  private applyRestFaceTransform() {
    if (this.activeFlyer && this.phase === "show") {
      const [tl, tr, br, bl] = this.flyerCornersLocal();
      this.flyerMesh.texture = this.activeFlyer;
      this.applyFlyerCorners(tl, tr, br, bl);
      this.flyerMesh.tint = this.poster.tint;
      this.flyerMesh.visible = true;
      this.poster.visible = false;
      this.poster.rotation = 0;
      this.poster.skew.set(0, 0);
      this.poster.scale.set(this.sheetScale);
      this.poster.position.set(this.restX, this.restY);
      this.poster.alpha = 1;
    } else {
      this.flyerMesh.visible = false;
      this.poster.visible = true;
      this.poster.rotation = 0;
      this.poster.skew.set(0, 0);
      this.poster.scale.set(this.poseScale());
      this.poster.position.set(this.restX, this.restY);
      this.poster.alpha = 1;
    }
  }

  private resetPosterPose() {
    this.applyRestFaceTransform();
    this.copy.visible = !this.activeFlyer;
  }

  private async paintPoster(job: WantedJob | null) {
    const token = ++this.loadToken;
    const critical = job?.priority === "CRITICAL";
    this.poster.tint = critical ? 0xffe6d2 : 0xffffff;

    const url = flyerUrlFor(job);
    let flyer: Texture | null = null;
    if (job && url) {
      flyer = this.flyerById.get(job.id) ?? null;
      if (!flyer) {
        try {
          const tex = await Assets.load<Texture>(url);
          if (token !== this.loadToken) return;
          flyer = tex;
          this.flyerById.set(job.id, tex);
        } catch {
          // Fall back to static player art path (baked catalog).
          if (job.slug) {
            try {
              const fallback = `/art/painted/farm/wanted/chores/${job.slug}.png`;
              const tex = await Assets.load<Texture>(fallback);
              if (token !== this.loadToken) return;
              flyer = tex;
              this.flyerById.set(job.id, tex);
            } catch {
              flyer = null;
            }
          }
        }
      }
    }
    if (token !== this.loadToken) return;

    this.activeFlyer = flyer;
    if (flyer) {
      this.setFlyerScaleFrom(flyer);
      this.emojiText.visible = false;
      this.rewardText.visible = false;
      this.copy.visible = false;
      if (this.phase === "show") {
        this.setFrame(WANTED_FRAME.pinned);
        this.applyRestFaceTransform();
      }
      return;
    }

    this.copy.visible = this.phase === "show";
    this.emojiText.text = job?.emoji || "";
    this.emojiText.visible = Boolean(job?.emoji);
    this.emojiText.position.set(0, -4);
    this.rewardText.visible = true;
    this.rewardText.text = formatJobBoardReward(job);
    this.rewardText.position.set(0, job ? 52 : 8);
    if (this.phase === "show") {
      this.setFrame(WANTED_FRAME.pinned);
      this.applyRestFaceTransform();
    }
  }
}
