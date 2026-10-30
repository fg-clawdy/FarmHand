import {
  boardRect,
  clamp01,
  farmBasketAnchor,
  planDonation,
  restScaleFor,
  zoomScaleFor,
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

export type Pose = { x: number; y: number; scale: number; opacity: number };

export type MotionDurations = {
  zoom: number;
  hold: number;
  away: number;
  lock: number;
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
      hold: 0.12,
      away: 0.28,
      lock: 0.12,
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
    zoom: 1.05,
    hold: 0.5,
    away: 1.75,
    lock: 0.52,
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

/** Smooth pulse. 0 at both ends, derivative 0 at both ends. */
export function lockBounce(t: number): number {
  const x = clamp01(t);
  if (x === 0 || x === 1) return 0;
  return Math.sin(Math.PI * x) ** 2 * 0.1;
}

export function lerpPose(rest: Pose, zoom: Pose, zoomU: number): Pose {
  const e = easeInOutCubic(zoomU);
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
  const amp = 6 * (1 - easeInOutCubic(clamp01(zoomU)));
  return Math.sin((timeSec * Math.PI * 2) / 3.6) * amp;
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

export function zoomPose(viewW: number, viewH: number, count: number): Pose {
  const board = boardRect(viewW, viewH);
  return {
    x: board.left + board.width * 0.3,
    y: board.top + board.height * 0.7,
    scale: zoomScaleFor(viewW, viewH, Math.max(1, count)),
    opacity: 1,
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
  };
}

export function stepAnim(state: AnimState, now: number, reduced: boolean): AnimState {
  const durations = motionDurations(reduced);
  if (state.phase === "rest" || state.phase === "reward") return state;

  if (state.phase === "zoom-in") {
    const u = clamp01((now - state.t0) / (durations.zoom * 1000));
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
    const u = clamp01((now - state.t0) / (durations.zoom * 1000));
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
  state: Pick<AnimState, "phase" | "zoomU" | "awayU">,
  timeSec: number,
  reduced: boolean,
): Pose {
  const rest = restPose(viewW, viewH, count);
  const zoom = zoomPose(viewW, viewH, count);
  if (state.phase === "away" || state.phase === "reward") {
    return awayPose(zoom, state.phase === "reward" ? 1 : state.awayU, viewH);
  }
  const pose = lerpPose(rest, zoom, state.zoomU);
  return { ...pose, y: pose.y + idleBob(timeSec, state.zoomU, reduced) };
}

export function boardOpacity(state: Pick<AnimState, "phase" | "zoomU" | "awayU">): number {
  if (state.phase === "away") return 1 - easeInOutCubic(state.awayU);
  if (state.phase === "reward") return 0;
  return easeInOutCubic(state.zoomU);
}

/** Ghost stays until the balloon locks, then fades with the same ease (no pop). */
export function ghostOpacity(full: boolean, locking: { index: number; t: number } | null, index: number): number {
  if (!full) return 1;
  if (locking && locking.index === index) return 1 - easeInOutCubic(locking.t);
  return 0;
}

export function bowOpacity(full: boolean, locking: { index: number; t: number } | null, index: number): number {
  if (!full) return 0;
  if (locking && locking.index === index) return easeInOutCubic(locking.t);
  return 1;
}

export function bodyDrawScale(
  bodyScale: number,
  locking: { index: number; t: number } | null,
  index: number,
  bounce: boolean,
): number {
  const extra = bounce && locking && locking.index === index ? lockBounce(locking.t) : 0;
  return bodyScale * (1 + extra);
}

export function donationPlan(cost: number, filled: number, amount: number, reduced: boolean) {
  const plan = planDonation(cost, filled, amount);
  return { plan, timeline: buildTimeline(plan, reduced) };
}
