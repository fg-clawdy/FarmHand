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
   * Linear scale is the square root of the filled area, so 100/200
   * covers half the ghost instead of a quarter of it.
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
    const fill = capacity === 0 ? 0 : stars / capacity;
    const full = capacity > 0 && stars >= capacity - 1e-4;
    slots.push({
      index,
      capacity,
      stars,
      fill,
      targetScale,
      bodyScale: bodyScaleFor(fill, targetScale),
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

/** Linear scale of the colored body. Area ratio to the ghost equals `fill`. */
export function bodyScaleFor(fill: number, targetScale: number): number {
  return targetScale * Math.sqrt(clamp01(fill));
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
  if (count <= 3) return 0.92;
  if (count <= 6) return 0.78;
  if (count <= 10) return 0.62;
  return 0.48;
}

/**
 * Neck positions relative to the basket at (0, 0). Y is up (negative).
 * Up to six balloons are a fan so each crown stays countable.
 * Index 0, the one that fills first, sits front and center.
 * Bigger goals are a tighter bouquet with that same balloon in front.
 */
export function bunchPoints(count: number): BunchPoint[] {
  if (count <= 0) return [];
  if (count === 1) return [{ index: 0, x: 0, y: -150 }];
  if (count <= 6) return smallFan(count);
  const golden = 2.399963229728653;
  const points: BunchPoint[] = [];
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + i * golden;
    const radius = 18 + Math.sqrt(i) * 22;
    const x = Math.cos(angle) * radius * 0.72;
    const y = -118 - Math.sin(angle) * radius * 0.42;
    points.push({ index: i, x, y });
  }
  const front = points.reduce((best, point) => (point.y > best.y ? point : best));
  const lead = points[0];
  if (lead && front !== lead) {
    lead.x = 0;
    lead.y = front.y + 36;
  }
  return points;
}

/** A countable fan. Larger y sits closer to the basket and in front. */
function smallFan(count: number): BunchPoint[] {
  const points: BunchPoint[] = [{ index: 0, x: 0, y: -142 }];
  const last = count - 1;
  const back: number[] = [];
  for (let index = 1; index < count; index++) {
    if (index !== last) back.push(index);
  }
  back.forEach((index, n) => {
    const t = back.length === 1 ? 0.5 : n / (back.length - 1);
    const spread = (t - 0.5) * 1.5;
    points.push({
      index,
      x: spread * 140,
      y: -262 - Math.cos(spread) * 16,
    });
  });
  if (last > 0) points.push({ index: last, x: 126, y: -170 });
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

const TEX_W = 1536;
const TEX_H = 1024;

/**
 * Open grass between the cow's roam box (u ≤ 0.49) and the market (u ≥ 0.61),
 * above the garden signs (v ≥ 0.40). The basket sits at the bottom of this pocket.
 */
const GRASS_POCKET = { u0: 0.545, u1: 0.602, v0: 0.14, v1: 0.392 } as const;

/** Share of the screen height the balloon being filled occupies while zoomed. */
export const ZOOM_HEIGHT = 0.45;

export function screenUv(viewW: number, viewH: number, u: number, v: number): { x: number; y: number } {
  const fit = coverFit(viewW, viewH, TEX_W, TEX_H);
  return {
    x: fit.x + u * TEX_W * fit.scale,
    y: fit.y + v * TEX_H * fit.scale,
  };
}

/** Screen pixels reserved under the basket for the pip row or the "N of 15" tally. */
export function chromeExtent(viewH: number): number {
  return Math.min(56, Math.max(40, viewH * 0.055));
}

export function restScaleFor(viewW: number, viewH: number, count: number): number {
  const safeCount = Math.max(1, count);
  const anchor = farmBasketAnchor(viewW, viewH);
  const u = (GRASS_POCKET.u0 + GRASS_POCKET.u1) / 2;
  const top = screenUv(viewW, viewH, u, GRASS_POCKET.v0);
  const left = screenUv(viewW, viewH, GRASS_POCKET.u0, GRASS_POCKET.v1);
  const right = screenUv(viewW, viewH, GRASS_POCKET.u1, GRASS_POCKET.v1);
  const span = bunchSpan(safeCount);
  const pocketW = Math.max(24, Math.abs(right.x - left.x) - 8);
  const pocketH = Math.max(24, anchor.y - top.y - 8);
  const fit = Math.min(pocketW / span.width, pocketH / span.height);
  return Math.max(0.03, Math.min(fit, scaleThatKeepsTop(anchor.y, safeCount, 12)));
}

/** Scale that makes the focused balloon's ghost about 45% of the screen height. */
export function zoomScaleFor(viewH: number, focusScale = 1): number {
  const ghost = BALLOON_TOP * Math.max(0.35, focusScale);
  return (viewH * ZOOM_HEIGHT) / ghost;
}

/** Largest scale whose highest balloon stays `margin` px below the top of the stage. */
function scaleThatKeepsTop(anchorY: number, count: number, margin: number): number {
  const points = bunchPoints(Math.max(1, count));
  const minY = Math.min(...points.map((point) => point.y)) - BALLOON_TOP;
  return Math.max(0.03, (anchorY - margin) / Math.max(1, -minY));
}

export function restingScreenWidth(viewW: number, viewH: number, count: number): number {
  return bunchSpan(count).width * restScaleFor(viewW, viewH, count);
}

export function zoomScreenWidth(viewH: number, count: number, focusScale = 1): number {
  return bunchSpan(count).width * zoomScaleFor(viewH, focusScale);
}

/** Axis-aligned screen box of the resting bunch, including the tally under the basket. */
export function restingBunchRect(
  viewW: number,
  viewH: number,
  count: number,
): { left: number; top: number; right: number; bottom: number } {
  const anchor = farmBasketAnchor(viewW, viewH);
  const scale = restScaleFor(viewW, viewH, count);
  const points = bunchPoints(Math.max(1, count));
  let left = anchor.x;
  let right = anchor.x;
  let top = anchor.y;
  for (const point of points) {
    left = Math.min(left, anchor.x + (point.x - BALLOON_HALF_W) * scale);
    right = Math.max(right, anchor.x + (point.x + BALLOON_HALF_W) * scale);
    top = Math.min(top, anchor.y + (point.y - BALLOON_TOP) * scale);
  }
  return { left, top, right, bottom: anchor.y + chromeExtent(viewH) };
}

/** Basket on open grass: right of the calf's path, left of the market, above the signs. */
export function farmBasketAnchor(viewW: number, viewH: number): { x: number; y: number } {
  const u = (GRASS_POCKET.u0 + GRASS_POCKET.u1) / 2;
  const bottom = screenUv(viewW, viewH, u, GRASS_POCKET.v1);
  return { x: bottom.x, y: bottom.y - chromeExtent(viewH) };
}

export function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}
