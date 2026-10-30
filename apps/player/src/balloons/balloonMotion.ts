import {
  BALLOON_HALF_W,
  BALLOON_TOP,
  bunchPoints,
  clamp01,
  farmBasketAnchor,
  planDonation,
  restScaleFor,
  STARS_PER_BALLOON,
  zoomScaleFor,
  type BunchPoint,
  type DonationPlan,
  type FillSegment,
} from "./balloonMath";

/**
 * Zero velocity at both ends so a zoom neither kicks off nor snaps into place.
 * f(0)=0, f(1)=1, f'(0)=0, f'(1)=0.
 */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * Ease-in-out whose middle is a glide, not a sprint.
 * Sine keeps the shrink visible across the whole return instead of dumping it into a few frames.
 */
export function easeInOutSoft(t: number): number {
  const x = clamp01(t);
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
}

/**
 * Ease-out with a small overshoot, then a settle back to 1.
 * f(0)=0, f(1)=1, and the peak is a little past the resting zoom.
 */
export function easeOutSettle(t: number): number {
  const x = clamp01(t);
  const c1 = 0.85;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

export type Pose = { x: number; y: number; scale: number; opacity: number };

export type MotionDurations = {
  /** @deprecated Use zoomIn. Kept so older call sites still compile. */
  zoom: number;
  zoomIn: number;
  zoomOut: number;
  hold: number;
  away: number;
  lock: number;
  /** Confetti is on screen this long before the reward card starts fading in. */
  cardDelay: number;
  cardFade: number;
  minInflate: number;
  maxInflate: number;
  perStar: number;
  bob: boolean;
  sparkle: boolean;
  confetti: boolean;
  bounce: boolean;
};

export function motionDurations(reduced: boolean): MotionDurations {
  if (reduced) {
    return {
      zoom: 0.22,
      zoomIn: 0.22,
      zoomOut: 0.24,
      hold: 0.12,
      away: 0.28,
      lock: 0.12,
      cardDelay: 0.08,
      cardFade: 0.12,
      minInflate: 0.16,
      maxInflate: 0.22,
      perStar: 0.0004,
      bob: false,
      sparkle: false,
      confetti: false,
      bounce: false,
    };
  }
  return {
    zoom: 0.95,
    zoomIn: 0.95,
    zoomOut: 1.05,
    hold: 0.65,
    away: 2.4,
    lock: 0.42,
    cardDelay: 1.2,
    cardFade: 0.4,
    minInflate: 0.95,
    maxInflate: 1.45,
    perStar: 0.009,
    bob: true,
    sparkle: true,
    confetti: true,
    bounce: true,
  };
}

export type SegmentWindow = FillSegment & { start: number; end: number };

export type Timeline = {
  from: number;
  to: number;
  windows: SegmentWindow[];
  duration: number;
  lock: number;
};

export function buildTimeline(plan: DonationPlan, reduced: boolean): Timeline {
  const durations = motionDurations(reduced);
  let cursor = 0;
  const windows: SegmentWindow[] = [];
  for (const segment of plan.segments) {
    const stars = Math.max(0, segment.toStars - segment.fromStars);
    const span = Math.min(durations.maxInflate, Math.max(durations.minInflate, stars * durations.perStar));
    windows.push({ ...segment, start: cursor, end: cursor + span });
    cursor += span;
    if (segment.completes) cursor += durations.lock;
  }
  return {
    from: plan.from,
    to: plan.to,
    windows,
    duration: cursor,
    lock: durations.lock,
  };
}

/** Eased star total. Flat during a lock beat so the full balloon can bounce before the next one grows. */
export function sampleDonation(from: number, windows: SegmentWindow[], time: number): number {
  let value = from;
  for (const window of windows) {
    const delta = window.toStars - window.fromStars;
    if (time < window.start) return value;
    if (time >= window.end) {
      value += delta;
      continue;
    }
    const u = (time - window.start) / Math.max(1e-6, window.end - window.start);
    return value + delta * easeInOutCubic(u);
  }
  return value;
}

export function lockProgress(timeline: Timeline, elapsed: number): { index: number; t: number } | null {
  const lock = timeline.lock;
  if (lock <= 0) return null;
  for (const window of timeline.windows) {
    if (!window.completes) continue;
    const end = window.end + lock;
    if (elapsed >= window.end && elapsed < end) {
      return { index: window.index, t: (elapsed - window.end) / lock };
    }
  }
  return null;
}

/** Squash then stretch, back to the honest size. 1 at both ends. */
export function lockSquash(t: number): { sx: number; sy: number } {
  const x = clamp01(t);
  if (x === 0 || x === 1) return { sx: 1, sy: 1 };
  const pulse = Math.sin(Math.PI * x);
  const dir = x < 0.42 ? 1 : -0.7;
  const amp = 0.2 * pulse * dir;
  return { sx: 1 + amp, sy: 1 - amp * 0.85 };
}

/** Peak extra scale of the lock squash. 0 at both ends. */
export function lockBounce(t: number): number {
  const { sx, sy } = lockSquash(t);
  return Math.max(Math.abs(sx - 1), Math.abs(sy - 1));
}

export function lerpPose(
  rest: Pose,
  zoom: Pose,
  zoomU: number,
  ease: (t: number) => number = easeInOutSoft,
): Pose {
  if (zoomU <= 0) return { ...rest };
  if (zoomU >= 1) return { ...zoom };
  const e = ease(zoomU);
  return {
    x: rest.x + (zoom.x - rest.x) * e,
    y: rest.y + (zoom.y - rest.y) * e,
    scale: rest.scale + (zoom.scale - rest.scale) * e,
    opacity: rest.opacity + (zoom.opacity - rest.opacity) * e,
  };
}

export function awayPose(zoom: Pose, awayU: number, viewH: number): Pose {
  const e = easeInOutCubic(awayU);
  return {
    x: zoom.x,
    y: zoom.y * (1 - e) + -viewH * 0.42 * e,
    scale: zoom.scale * (1 + 0.06 * e),
    opacity: 1 - e,
  };
}

export function idleBob(timeSec: number, zoomU: number, reduced: boolean): number {
  if (reduced || !motionDurations(reduced).bob) return 0;
  const amp = 12 * (1 - easeInOutSoft(clamp01(zoomU)));
  return Math.sin((timeSec * Math.PI * 2) / 2.8) * amp;
}

export function restPose(viewW: number, viewH: number, count: number): Pose {
  const anchor = farmBasketAnchor(viewW, viewH);
  return {
    x: anchor.x,
    y: anchor.y,
    scale: restScaleFor(viewW, viewH, Math.max(1, count)),
    opacity: 1,
  };
}

/** Inset so the overshoot (~4%) still leaves the bunch 40px inside the frame. */
export const ZOOM_MARGIN = 84;
/** Screen pixels under the basket for the pip row and the star count. */
export const ZOOM_LABEL_H = 64;
/** easeOutSettle peaks a little above 1. Fit the settled pose inside that. */
const ZOOM_OVERSHOOT = 1.04;

function localBunchBounds(points: BunchPoint[]) {
  let minX = -36;
  let maxX = 36;
  let minY = -40;
  let maxY = 36;
  for (const point of points) {
    minX = Math.min(minX, point.x - BALLOON_HALF_W - 14);
    maxX = Math.max(maxX, point.x + BALLOON_HALF_W + 14);
    minY = Math.min(minY, point.y - BALLOON_TOP);
    maxY = Math.max(maxY, point.y + 8);
  }
  return { minX, maxX, minY, maxY };
}

/**
 * The same bunch, brought forward, scaled so every ghost, the string,
 * the basket, and the label stay inside the frame.
 */
export function zoomPose(
  viewW: number,
  viewH: number,
  count: number,
  _focusIndex = 0,
  focusScale = 1,
): Pose {
  const points = bunchPoints(Math.max(1, count));
  const bounds = localBunchBounds(points);
  const margin = ZOOM_MARGIN;
  const availW = Math.max(80, viewW - margin * 2);
  const availH = Math.max(80, viewH - margin * 2 - ZOOM_LABEL_H);
  const localW = Math.max(1, bounds.maxX - bounds.minX);
  const localH = Math.max(1, 16 - bounds.minY);
  const fit = Math.min(availW / localW, availH / localH);
  const hero = zoomScaleFor(viewH, focusScale);
  const scale = Math.min(fit, hero) / ZOOM_OVERSHOOT;
  const extraW = availW - localW * scale;
  const x = margin + extraW / 2 - bounds.minX * scale;
  const graphicsH = (bounds.maxY - bounds.minY) * scale;
  const blockH = graphicsH + ZOOM_LABEL_H;
  const extraH = Math.max(0, viewH - margin * 2 - blockH);
  const y = margin + extraH / 2 - bounds.minY * scale;
  return { x, y, scale, opacity: 1 };
}

/** Screen box of the settled zoom, including the label under the basket. */
export function zoomBunchRect(
  viewW: number,
  viewH: number,
  count: number,
  focusIndex = 0,
  focusScale = 1,
) {
  const pose = zoomPose(viewW, viewH, count, focusIndex, focusScale);
  const bounds = localBunchBounds(bunchPoints(Math.max(1, count)));
  return {
    left: pose.x + bounds.minX * pose.scale,
    top: pose.y + bounds.minY * pose.scale,
    right: pose.x + bounds.maxX * pose.scale,
    bottom: pose.y + 16 * pose.scale + ZOOM_LABEL_H,
  };
}

export type AnimPhase = "rest" | "zoom-in" | "inflate" | "hold" | "zoom-out" | "away" | "reward";

export type AnimState = {
  phase: AnimPhase;
  zoomU: number;
  awayU: number;
  shown: number;
  locking: { index: number; t: number } | null;
  t0: number;
  timeline: Timeline | null;
  reached: boolean;
  /** Balloon the zoom centers on. Stays put for the whole gesture so overflow does not jump. */
  focusIndex: number;
  focusScale: number;
};

export function restAnim(shown: number): AnimState {
  return {
    phase: "rest",
    zoomU: 0,
    awayU: 0,
    shown,
    locking: null,
    t0: 0,
    timeline: null,
    reached: false,
    focusIndex: 0,
    focusScale: 1,
  };
}

export function beginDonation(shown: number, plan: DonationPlan, reduced: boolean, now: number): AnimState {
  return {
    phase: "zoom-in",
    zoomU: 0,
    awayU: 0,
    shown,
    locking: null,
    t0: now,
    timeline: buildTimeline(plan, reduced),
    reached: plan.reached,
    focusIndex: plan.segments[0]?.index ?? 0,
    focusScale: (plan.segments[0]?.capacity ?? STARS_PER_BALLOON) / STARS_PER_BALLOON,
  };
}

export function stepAnim(state: AnimState, now: number, reduced: boolean): AnimState {
  const durations = motionDurations(reduced);
  if (state.phase === "rest" || state.phase === "reward") return state;

  if (state.phase === "zoom-in") {
    const u = clamp01((now - state.t0) / (durations.zoomIn * 1000));
    if (u >= 1) {
      return { ...state, zoomU: 1, phase: "inflate", t0: now, locking: null };
    }
    return { ...state, zoomU: u };
  }

  if (state.phase === "inflate") {
    const timeline = state.timeline;
    if (!timeline) return { ...state, phase: "hold", t0: now, zoomU: 1 };
    const elapsed = (now - state.t0) / 1000;
    if (elapsed >= timeline.duration) {
      return {
        ...state,
        shown: timeline.to,
        locking: null,
        phase: "hold",
        t0: now,
        zoomU: 1,
      };
    }
    return {
      ...state,
      shown: sampleDonation(timeline.from, timeline.windows, elapsed),
      locking: lockProgress(timeline, elapsed),
      zoomU: 1,
    };
  }

  if (state.phase === "hold") {
    if (now - state.t0 >= durations.hold * 1000) {
      return {
        ...state,
        phase: state.reached ? "away" : "zoom-out",
        t0: now,
        awayU: 0,
        zoomU: 1,
        shown: state.timeline?.to ?? state.shown,
        locking: null,
      };
    }
    return state;
  }

  if (state.phase === "zoom-out") {
    const u = clamp01((now - state.t0) / (durations.zoomOut * 1000));
    if (u >= 1) return { ...state, zoomU: 0, phase: "rest" };
    return { ...state, zoomU: 1 - u };
  }

  if (state.phase === "away") {
    const u = clamp01((now - state.t0) / (durations.away * 1000));
    if (u >= 1) return { ...state, awayU: 1, zoomU: 1, phase: "reward" };
    return { ...state, awayU: u, zoomU: 1 };
  }

  return state;
}

export function bunchPose(
  viewW: number,
  viewH: number,
  count: number,
  state: Pick<AnimState, "phase" | "zoomU" | "awayU"> & Partial<Pick<AnimState, "focusIndex" | "focusScale">>,
  timeSec: number,
  reduced: boolean,
): Pose {
  const rest = restPose(viewW, viewH, count);
  const zoom = zoomPose(viewW, viewH, count, state.focusIndex ?? 0, state.focusScale ?? 1);
  if (state.phase === "away" || state.phase === "reward") {
    return awayPose(zoom, state.phase === "reward" ? 1 : state.awayU, viewH);
  }
  const ease = state.phase === "zoom-in" ? easeOutSettle : easeInOutSoft;
  const pose = lerpPose(rest, zoom, state.zoomU, ease);
  return { ...pose, y: pose.y + idleBob(timeSec, state.zoomU, reduced) };
}

/** Farm dim while the bunch is in front. Fades out as the balloons float away. */
export function sceneDim(state: Pick<AnimState, "phase" | "zoomU" | "awayU">): number {
  if (state.phase === "away") return 1 - easeInOutSoft(state.awayU);
  if (state.phase === "reward") return 0;
  if (state.phase === "zoom-in") return clamp01(easeOutSettle(state.zoomU));
  return easeInOutSoft(state.zoomU);
}

/**
 * 0 until confetti has been up for `cardDelay`, then 0..1 across `cardFade`.
 * Fully up once the reward phase is showing.
 */
export function cardReveal(state: Pick<AnimState, "phase" | "awayU">, reduced: boolean): number {
  if (state.phase === "reward") return 1;
  if (state.phase !== "away") return 0;
  const durations = motionDurations(reduced);
  const elapsed = state.awayU * durations.away;
  return clamp01((elapsed - durations.cardDelay) / Math.max(0.05, durations.cardFade));
}

/** Ghost stays through the start of the lock, then fades. Not an instant swap. */
export function ghostOpacity(full: boolean, locking: { index: number; t: number } | null, index: number): number {
  if (!full) return 1;
  if (locking && locking.index === index) {
    const u = clamp01((locking.t - 0.28) / 0.72);
    return 1 - easeInOutSoft(u);
  }
  return 0;
}

export function bowOpacity(full: boolean, locking: { index: number; t: number } | null, index: number): number {
  if (!full) return 0;
  if (locking && locking.index === index) return easeInOutSoft(clamp01((locking.t - 0.08) / 0.92));
  return 1;
}

export function bodyDrawScale(
  bodyScale: number,
  _locking: { index: number; t: number } | null,
  _index: number,
  _bounce: boolean,
): number {
  return bodyScale;
}

export function donationPlan(cost: number, filled: number, amount: number, reduced: boolean) {
  const plan = planDonation(cost, filled, amount);
  return { plan, timeline: buildTimeline(plan, reduced) };
}
