import { coverFit } from "../pixi/draw";
import { PLAYFIELD_LAYOUT } from "../pixi/playfieldLayout";

/**
 * Stars in one full-size balloon.
 * One constant so it can move to an admin tunable later without hunting call sites.
 */
export const STARS_PER_BALLOON = 200;

export const BALLOON_STAGE = { width: 2560, height: 1600 } as const;

export const BALLOON_GOAL_COSTS = [200, 1000, 1100, 3000] as const;

export const GIVE_AMOUNTS = [5, 25, 100, 250] as const;

/** How many goal bunches sit on the library spot before a +N tag. */
export const BUNCH_SHOW_MAX = 3;

export type QaGoal = { id: string; title: string; cost: number; filled: number };

/** QA shortcuts. Goals share the little-library spot. "100 → +250" crosses a balloon. */
export const BALLOON_PRESETS: readonly { id: string; label: string; goals: readonly QaGoal[] }[] = [
  { id: "goals-0", label: "0 goals", goals: [] },
  {
    id: "goals-1",
    label: "1 goal",
    goals: [{ id: "movie", title: "Movie night", cost: 1100, filled: 0 }],
  },
  {
    id: "goals-2",
    label: "2 goals",
    goals: [
      { id: "movie", title: "Movie night", cost: 1100, filled: 400 },
      { id: "ice", title: "Ice cream", cost: 200, filled: 100 },
    ],
  },
  {
    id: "goals-3",
    label: "3 goals",
    goals: [
      { id: "movie", title: "Movie night", cost: 1100, filled: 0 },
      { id: "ice", title: "Ice cream", cost: 200, filled: 100 },
      { id: "park", title: "Park day", cost: 1000, filled: 0 },
    ],
  },
  {
    id: "handoff",
    label: "100 → +250",
    goals: [{ id: "movie", title: "Movie night", cost: 1100, filled: 100 }],
  },
  {
    id: "rest-3000",
    label: "3,000 · rest",
    goals: [{ id: "movie", title: "Movie night", cost: 3000, filled: 0 }],
  },
];

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
 * The balloon a child is filling, or the next empty one when nothing is underway.
 * A finished goal keeps its last balloon in front for the float-away.
 */
export function activeBalloonIndex(cost: number, filled: number): number {
  const slots = balloonsFor(cost, filled);
  if (slots.length === 0) return 0;
  const open = slots.find((slot) => slot.stars < slot.capacity - 1e-6);
  return open?.index ?? slots.length - 1;
}

/**
 * Neck positions relative to the basket at (0, 0). Y is up (negative).
 * These are slots, not balloons. The balloon being filled is placed in the
 * front slot by `placedPoints`. Up to six slots are a fan. Bigger goals cluster.
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

/**
 * Slot order: the front neck, then the back row (center first), then the wings.
 * The balloon being filled takes the front. Finished balloons take the back
 * so they stay solid and visible. Empty ghosts take the wings.
 */
function slotOrder(count: number): BunchPoint[] {
  const points = bunchPoints(count);
  if (points.length <= 1) return points;
  const front = points.reduce((best, point) => (point.y > best.y ? point : best));
  const rest = points.filter((point) => point !== front);
  const backLine = Math.min(...rest.map((point) => point.y));
  const backs = rest
    .filter((point) => point.y < backLine + 40)
    .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.x - b.x);
  const outers = rest
    .filter((point) => !backs.includes(point))
    .sort((a, b) => Math.abs(a.x) - Math.abs(b.x) || a.x - b.x);
  return [front, ...backs, ...outers];
}

/** Where each balloon's neck sits for this active index. Index in the result is the balloon. */
export function placedPoints(count: number, activeIndex: number): BunchPoint[] {
  if (count <= 0) return [];
  const slots = slotOrder(count);
  const active = Math.min(Math.max(0, activeIndex), count - 1);
  const order = [active];
  for (let index = active - 1; index >= 0; index--) order.push(index);
  for (let index = active + 1; index < count; index++) order.push(index);
  const placed: BunchPoint[] = [];
  order.forEach((balloonIndex, slotIndex) => {
    const slot = slots[slotIndex] ?? slots[slots.length - 1]!;
    placed[balloonIndex] = { index: balloonIndex, x: slot.x, y: slot.y };
  });
  return placed;
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
 * Where the little library's post met the grass. The basket sits on this point.
 * The band is the library column, stopping before the cow's path to the right.
 */
export const LIBRARY_POST = {
  u: (PLAYFIELD_LAYOUT.libraryHit.u0 + PLAYFIELD_LAYOUT.libraryHit.u1) / 2,
  v: PLAYFIELD_LAYOUT.libraryHit.v1,
} as const;

const LIBRARY_BAND = {
  u0: PLAYFIELD_LAYOUT.libraryHit.u0,
  u1: 0.398,
  vTop: PLAYFIELD_LAYOUT.libraryHit.v0,
} as const;

/** Local y of the basket's ground shadow. The flight origin is the string knot. */
export const BASKET_GROUND = 30;

/** How much bigger the resting bunch is than the previous grass-pocket size. */
export const REST_SIZE_BOOST = 1.5;

/** Screen width of one bunch when several goals share the library grass. */
const SHARED_SLOT = 64;

/** Open grass from just right of the tractor to just left of the cow. */
const SHARED_GRASS = { u0: 0.312, u1: 0.48 } as const;

/** The pocket the resting bunch used before it moved onto the library post. */
const FORMER_POCKET = { u0: 0.545, u1: 0.602, v0: 0.14, v1: 0.392 } as const;

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

/** Scale the bunch used when it sat on the open grass between the cow and the stand. */
function formerRestScale(viewW: number, viewH: number, count: number): number {
  const safeCount = Math.max(1, count);
  const u = (FORMER_POCKET.u0 + FORMER_POCKET.u1) / 2;
  const anchorY = screenUv(viewW, viewH, u, FORMER_POCKET.v1).y - chromeExtent(viewH);
  const top = screenUv(viewW, viewH, u, FORMER_POCKET.v0);
  const left = screenUv(viewW, viewH, FORMER_POCKET.u0, FORMER_POCKET.v1);
  const right = screenUv(viewW, viewH, FORMER_POCKET.u1, FORMER_POCKET.v1);
  const span = bunchSpan(safeCount);
  const pocketW = Math.max(24, Math.abs(right.x - left.x) - 8);
  const pocketH = Math.max(24, anchorY - top.y - 8);
  const fit = Math.min(pocketW / span.width, pocketH / span.height);
  return Math.max(0.03, Math.min(fit, scaleThatKeepsTop(anchorY, safeCount, 12)));
}

function libraryLimits(viewW: number, viewH: number) {
  const ground = screenUv(viewW, viewH, LIBRARY_POST.u, LIBRARY_POST.v);
  const left = screenUv(viewW, viewH, LIBRARY_BAND.u0, LIBRARY_POST.v);
  const right = screenUv(viewW, viewH, LIBRARY_BAND.u1, LIBRARY_POST.v);
  const roof = screenUv(viewW, viewH, LIBRARY_POST.u, LIBRARY_BAND.vTop);
  return { ground, left: left.x, right: right.x, headroom: Math.max(48, ground.y - roof.y) };
}

/**
 * Resting scale. About 1.5× the old grass-pocket size, clamped so the bunch
 * still fits the library column when several goals share it.
 */
export function restScaleFor(viewW: number, viewH: number, count: number, goalsSharing = 1): number {
  const safeCount = Math.max(1, count);
  const sharing = Math.min(BUNCH_SHOW_MAX, Math.max(1, goalsSharing));
  const boosted = formerRestScale(viewW, viewH, safeCount) * REST_SIZE_BOOST;
  const limits = libraryLimits(viewW, viewH);
  const span = bunchSpan(safeCount);
  const fitH = limits.headroom / span.height;
  const slotW = sharing === 1 ? Number.POSITIVE_INFINITY : SHARED_SLOT - 8;
  const fitW = slotW / span.width;
  let scale = Math.max(0.03, Math.min(boosted, fitW, fitH));
  if (sharing === 1) {
    const points = bunchPoints(safeCount);
    const minX = Math.min(...points.map((point) => point.x - BALLOON_HALF_W));
    const maxX = Math.max(...points.map((point) => point.x + BALLOON_HALF_W));
    const leftRoom = limits.ground.x - limits.left;
    const rightRoom = limits.right - limits.ground.x;
    if (minX < 0) scale = Math.min(scale, leftRoom / -minX);
    if (maxX > 0) scale = Math.min(scale, rightRoom / maxX);
    const topLocal = Math.min(...points.map((point) => point.y - BALLOON_TOP));
    scale = Math.min(scale, limits.headroom / Math.max(1, BASKET_GROUND - topLocal));
  }
  return Math.max(0.03, scale);
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

export type GoalSeat = { x: number; y: number; scale: number };

/** One seat per shown goal. A single basket sits on the library post. */
export function goalSeats(viewW: number, viewH: number, counts: number[]): GoalSeat[] {
  const shown = counts.slice(0, BUNCH_SHOW_MAX);
  if (shown.length === 0) return [];
  const scale = Math.min(
    ...shown.map((count) => restScaleFor(viewW, viewH, Math.max(1, count), shown.length)),
  );
  const ground = screenUv(viewW, viewH, LIBRARY_POST.u, LIBRARY_POST.v);
  const y = ground.y - BASKET_GROUND * scale;
  if (shown.length === 1) return [{ x: ground.x, y, scale }];
  const gap = 8;
  const total = shown.length * SHARED_SLOT + (shown.length - 1) * gap;
  let left = ground.x - SHARED_SLOT / 2;
  const grassLeft = screenUv(viewW, viewH, SHARED_GRASS.u0, LIBRARY_POST.v).x;
  const grassRight = screenUv(viewW, viewH, SHARED_GRASS.u1, LIBRARY_POST.v).x;
  if (left < grassLeft) left = grassLeft;
  if (left + total > grassRight) left = Math.max(grassLeft, grassRight - total);
  return shown.map(() => {
    const seat = { x: left + SHARED_SLOT / 2, y, scale };
    left += SHARED_SLOT + gap;
    return seat;
  });
}

export function goalOverflow(goalCount: number): number {
  return Math.max(0, goalCount - BUNCH_SHOW_MAX);
}

/** Axis-aligned screen box of one resting bunch, including the tally under the basket. */
export function restingBunchRect(
  viewW: number,
  viewH: number,
  count: number,
  goalsSharing = 1,
  seatIndex = 0,
): { left: number; top: number; right: number; bottom: number } {
  const seats = goalSeats(
    viewW,
    viewH,
    Array.from({ length: Math.max(1, goalsSharing) }, (_, index) => (index === seatIndex ? count : count)),
  );
  const seat = seats[Math.min(seatIndex, seats.length - 1)] ?? goalSeats(viewW, viewH, [count])[0]!;
  const points = bunchPoints(Math.max(1, count));
  let left = seat.x;
  let right = seat.x;
  let top = seat.y;
  for (const point of points) {
    left = Math.min(left, seat.x + (point.x - BALLOON_HALF_W) * seat.scale);
    right = Math.max(right, seat.x + (point.x + BALLOON_HALF_W) * seat.scale);
    top = Math.min(top, seat.y + (point.y - BALLOON_TOP) * seat.scale);
  }
  return { left, top, right, bottom: seat.y + BASKET_GROUND * seat.scale + chromeExtent(viewH) };
}

/** Basket on the grass where the library post met the ground. */
export function farmBasketAnchor(viewW: number, viewH: number, count = 6): { x: number; y: number } {
  const seat = goalSeats(viewW, viewH, [Math.max(1, count)])[0]!;
  return { x: seat.x, y: seat.y };
}

export function clamp01(n: number): number {
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}
