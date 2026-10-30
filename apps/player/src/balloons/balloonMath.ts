import { coverFit } from "../pixi/draw";

/**
 * Stars in one full-size balloon.
 * One constant so it can move to an admin tunable later without hunting call sites.
 */
export const STARS_PER_BALLOON = 200;

export const BALLOON_STAGE = { width: 2560, height: 1600 } as const;

export const BALLOON_GOAL_COSTS = [200, 1000, 1100, 3000] as const;

export const GIVE_AMOUNTS = [5, 25, 100, 250] as const;

/** QA shortcuts. "200 · half" is the exactly-half read (100 of 200). */
export const BALLOON_PRESETS = [
  { id: "half", label: "200 · half", cost: 200, filled: 100 },
  { id: "empty-1100", label: "1,100 · empty", cost: 1100, filled: 0 },
  { id: "partial-1100", label: "1,100 · partial", cost: 1100, filled: 1050 },
  { id: "rest-3000", label: "3,000 · rest", cost: 3000, filled: 0 },
] as const;

export const START_WALLET = 4000;

/** Local balloon drawing: neck at the origin, body above it (negative y). */
export const BALLOON_HALF_W = 108;
export const BALLOON_TOP = 248;

export type BalloonSlot = {
  index: number;
  /** Stars this balloon can hold. The last slot keeps the remainder. */
  capacity: number;
  stars: number;
  /** 0..1 of this balloon's own capacity. */
  fill: number;
  /**
   * Ghost outline size relative to a full 200★ balloon.
   * A 100★ remainder ghost is exactly half size.
   */
  targetScale: number;
  /**
   * Colored body size relative to a full 200★ balloon.
   * Exact: stars / STARS_PER_BALLOON. Empty is 0 (ghost + nub still draw).
   */
  bodyScale: number;
  full: boolean;
};

export type FillSegment = {
  index: number;
  fromStars: number;
  toStars: number;
  capacity: number;
  completes: boolean;
};

export type DonationPlan = {
  from: number;
  to: number;
  accepted: number;
  reached: boolean;
  segments: FillSegment[];
};

export type BunchPoint = { index: number; x: number; y: number };

export function balloonCount(cost: number): number {
  if (cost <= 0) return 0;
  return Math.ceil(cost / STARS_PER_BALLOON);
}

export function slotCapacity(cost: number, index: number): number {
  const count = balloonCount(cost);
  if (index < 0 || index >= count) return 0;
  const start = index * STARS_PER_BALLOON;
  return Math.min(STARS_PER_BALLOON, Math.max(0, cost - start));
}

/** Fill balloons in order. Floats are allowed so an in-flight donation can ease. */
export function balloonsFor(cost: number, filled: number): BalloonSlot[] {
  const safeCost = Math.max(0, cost);
  const clamped = Math.max(0, Math.min(filled, safeCost));
  const count = balloonCount(safeCost);
  let remaining = clamped;
  const slots: BalloonSlot[] = [];
  for (let index = 0; index < count; index++) {
    const capacity = slotCapacity(safeCost, index);
    const stars = Math.min(capacity, Math.max(0, remaining));
    remaining -= stars;
    const targetScale = capacity / STARS_PER_BALLOON;
    const full = capacity > 0 && stars >= capacity - 1e-4;
    slots.push({
      index,
      capacity,
      stars,
      fill: capacity === 0 ? 0 : stars / capacity,
      targetScale,
      bodyScale: stars / STARS_PER_BALLOON,
      full,
    });
  }
  return slots;
}

export function planDonation(cost: number, filled: number, amount: number): DonationPlan {
  const safeCost = Math.max(0, Math.round(cost));
  const from = Math.max(0, Math.min(Math.round(filled), safeCost));
  const accepted = Math.max(0, Math.min(Math.round(amount), safeCost - from));
  const to = from + accepted;
  const segments: FillSegment[] = [];
  let cursor = from;
  while (cursor < to) {
    const slots = balloonsFor(safeCost, cursor);
    const active = slots.find((slot) => slot.stars < slot.capacity - 1e-6);
    if (!active) break;
    const step = Math.min(active.capacity - active.stars, to - cursor);
    const toStars = active.stars + step;
    segments.push({
      index: active.index,
      fromStars: active.stars,
      toStars,
      capacity: active.capacity,
      completes: toStars >= active.capacity - 1e-6,
    });
    cursor += step;
  }
  return {
    from,
    to,
    accepted,
    reached: safeCost > 0 && to >= safeCost,
    segments,
  };
}

/** 0 stars still has a nub. It fades out as the colored body takes the neck. */
export function nubOpacity(bodyScale: number, targetScale: number): number {
  const fadeOver = Math.max(0.04, targetScale * 0.22);
  if (bodyScale <= 0) return 1;
  return clamp01(1 - bodyScale / fadeOver);
}

export function formatStarCount(n: number): string {
  const rounded = Math.max(0, Math.round(n));
  return String(rounded).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * How tightly a bunch packs as the count grows.
 * 1 = a single hero balloon. Smaller = clustered.
 */
export function restingFootprint(count: number): number {
  if (count <= 1) return 1;
  if (count <= 3) return 0.98;
  if (count <= 6) return 0.92;
  if (count <= 10) return 0.8;
  return 0.68;
}

/** Back row first so the front row (drawn last, filled last) stays readable. Counts up to 6 stay on one row. */
export function rowPattern(count: number): number[] {
  if (count <= 0) return [];
  if (count <= 6) return [count];
  if (count <= 10) {
    const front = Math.ceil(count / 2);
    return [count - front, front];
  }
  const rows = 3;
  const base = Math.floor(count / rows);
  const extra = count % rows;
  const out = Array.from({ length: rows }, () => base);
  for (let i = 0; i < extra; i++) out[rows - 1 - i] += 1;
  return out;
}

/** Neck positions relative to the basket at (0, 0). Y is up (negative). Gaps stay wide enough that ghosts stay countable. */
export function bunchPoints(count: number): BunchPoint[] {
  const rows = rowPattern(count);
  const colGap = 196;
  const rowGap = 228;
  const points: BunchPoint[] = [];
  let index = 0;
  const nRows = rows.length;
  rows.forEach((n, rowFromBack) => {
    const depthFromFront = nRows - 1 - rowFromBack;
    for (let col = 0; col < n; col++) {
      const x = (col - (n - 1) / 2) * colGap;
      const along = n <= 1 ? 0 : (col / (n - 1)) * Math.PI;
      const arch = Math.sin(along) * (nRows === 1 ? 36 : 10);
      const y = -(156 + depthFromFront * rowGap) - arch;
      points.push({ index, x, y });
      index += 1;
    }
  });
  return points;
}

export function bunchSpan(count: number): { width: number; height: number } {
  const pts = bunchPoints(count);
  if (pts.length === 0) return { width: BALLOON_HALF_W * 2, height: BALLOON_TOP + 80 };
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 110;
  for (const point of pts) {
    minX = Math.min(minX, point.x - BALLOON_HALF_W);
    maxX = Math.max(maxX, point.x + BALLOON_HALF_W);
    minY = Math.min(minY, point.y - BALLOON_TOP);
    maxY = Math.max(maxY, point.y + 16);
  }
  return { width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

export function restScaleFor(viewW: number, viewH: number, count: number): number {
  const safeCount = Math.max(1, count);
  const span = Math.max(1, bunchSpan(safeCount).width);
  const target =
    safeCount <= 1
      ? Math.min(viewW * 0.11, 280)
      : safeCount <= 6
        ? Math.min(viewW * 0.19, 480)
        : safeCount <= 10
          ? Math.min(viewW * 0.16, 400)
          : Math.min(viewW * 0.13, 320);
  const anchor = farmBasketAnchor(viewW, viewH);
  return Math.min(target / span, scaleThatKeepsTop(anchor.y, safeCount, 280));
}

export function boardRect(viewW: number, viewH: number) {
  const width = Math.min(Math.round(viewW * 0.78), 1680);
  const height = Math.min(Math.round(viewH * 0.7), 1040);
  const left = Math.round((viewW - width) / 2);
  const top = Math.round((viewH - height) / 2 - 10);
  return { left, top, width, height };
}

export function zoomScaleFor(viewW: number, viewH: number, count: number): number {
  const safeCount = Math.max(1, count);
  const span = Math.max(1, bunchSpan(safeCount).width);
  const board = boardRect(viewW, viewH);
  const fit = (board.width * (safeCount >= 12 ? 0.46 : 0.48)) / span;
  const rest = restScaleFor(viewW, viewH, safeCount);
  const anchorY = board.top + board.height * 0.7;
  return Math.min(fit, rest * 2.15, scaleThatKeepsTop(anchorY, safeCount, 56));
}

/** Largest scale whose highest balloon stays `margin` px below the top of the stage. */
function scaleThatKeepsTop(anchorY: number, count: number, margin: number): number {
  const points = bunchPoints(Math.max(1, count));
  const minY = Math.min(...points.map((point) => point.y)) - BALLOON_TOP;
  return Math.max(0.05, (anchorY - margin) / Math.max(1, -minY));
}

export function restingScreenWidth(viewW: number, count: number): number {
  return bunchSpan(count).width * restScaleFor(viewW, BALLOON_STAGE.height, count);
}

export function zoomScreenWidth(viewW: number, viewH: number, count: number): number {
  return bunchSpan(count).width * zoomScaleFor(viewW, viewH, count);
}

/** Basket anchor on the painted playfield, in the open grass above the center garden sign. */
export function farmBasketAnchor(viewW: number, viewH: number): { x: number; y: number } {
  const fit = coverFit(viewW, viewH, 1536, 1024);
  const u = 0.55;
  const v = 0.45;
  return {
    x: fit.x + u * 1536 * fit.scale,
    y: fit.y + v * 1024 * fit.scale,
  };
}

export function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}
