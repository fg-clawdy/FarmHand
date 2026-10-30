import { coverFit } from "../pixi/draw";
import { PLAYFIELD_LAYOUT, standArtUv } from "../pixi/playfieldLayout";

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

const FRONT_NECK = { x: 0, y: -156 };

/** Completed balloons, newest first: beside the front balloon, then a step out and up. */
function ringNecks(completed: number): BunchPoint[] {
  const necks: BunchPoint[] = [];
  for (let i = 0; i < completed; i++) {
    const side = i % 2 === 0 ? 1 : -1;
    const row = Math.floor(i / 2);
    necks.push({
      index: i,
      x: side * (176 + row * 156),
      y: FRONT_NECK.y - 4 - row * 22,
    });
  }
  return necks;
}

/** Empty ghosts: a high back arc, behind the front row. */
function ghostNecks(ghosts: number): BunchPoint[] {
  const necks: BunchPoint[] = [];
  for (let i = 0; i < ghosts; i++) {
    const t = ghosts === 1 ? 0.5 : i / (ghosts - 1);
    const spread = (t - 0.5) * 2;
    necks.push({
      index: i,
      x: spread * 96,
      y: -392 - (1 - Math.abs(spread)) * 18,
    });
  }
  return necks;
}

/**
 * Where each balloon's neck sits.
 * The balloon being filled is front-center. Finished balloons take the front
 * row beside it. Empty ghosts take the back arc.
 */
export function placedPoints(count: number, activeIndex: number): BunchPoint[] {
  if (count <= 0) return [];
  const active = Math.min(Math.max(0, activeIndex), count - 1);
  const slots = [{ index: 0, ...FRONT_NECK }, ...ringNecks(active), ...ghostNecks(count - active - 1)];
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

/** Ellipse covering a balloon body. Used to measure how much of a solid balloon stays visible. */
export function balloonEllipse(point: BunchPoint, targetScale: number) {
  const scale = Math.max(0.35, targetScale);
  return {
    cx: point.x,
    cy: point.y - 124 * scale,
    rx: 96 * scale,
    ry: 108 * scale,
  };
}

function insideEllipse(ellipse: { cx: number; cy: number; rx: number; ry: number }, x: number, y: number) {
  const dx = (x - ellipse.cx) / ellipse.rx;
  const dy = (y - ellipse.cy) / ellipse.ry;
  return dx * dx + dy * dy <= 1;
}

/**
 * Share of each solid balloon that is not covered by a balloon drawn in front of it.
 * Ghosts are drawn behind solids, so they do not count. The active balloon is drawn last.
 */
export function solidVisibility(
  count: number,
  activeIndex: number,
  targetScales: readonly number[],
  bodyScales: readonly number[],
): number[] {
  const placed = placedPoints(count, activeIndex);
  const ellipses = placed.map((point, index) => balloonEllipse(point, targetScales[index] ?? 1));
  const solid = placed.map((_, index) => (bodyScales[index] ?? 0) > 0.2);
  const order = placed
    .map((point, index) => ({ index, y: point.y, active: index === activeIndex }))
    .filter((item) => solid[item.index] || item.active)
    .sort((a, b) => Number(a.active) - Number(b.active) || a.y - b.y);
  return placed.map((_point, index) => {
    if (!solid[index]) return 1;
    const ellipse = ellipses[index]!;
    const later = order.filter((item) => item.index !== index).slice(order.findIndex((item) => item.index === index) + 1);
    let open = 0;
    let total = 0;
    const steps = 11;
    for (let iy = 0; iy < steps; iy++) {
      for (let ix = 0; ix < steps; ix++) {
        const x = ellipse.cx + ((ix + 0.5) / steps - 0.5) * 2 * ellipse.rx;
        const y = ellipse.cy + ((iy + 0.5) / steps - 0.5) * 2 * ellipse.ry;
        if (!insideEllipse(ellipse, x, y)) continue;
        total += 1;
        const covered = later.some((item) => insideEllipse(ellipses[item.index]!, x, y));
        if (!covered) open += 1;
      }
    }
    return total === 0 ? 1 : open / total;
  });
}

function necksForSpan(count: number): BunchPoint[] {
  if (count <= 0) return [];
  const necks: BunchPoint[] = [];
  for (let active = 0; active < count; active++) necks.push(...placedPoints(count, active));
  return necks;
}

export function bunchSpan(count: number): { width: number; height: number } {
  const pts = necksForSpan(count);
  if (pts.length === 0) return { width: BALLOON_HALF_W * 2, height: BALLOON_TOP + 80 };
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = BASKET_GROUND;
  for (const point of pts) {
    minX = Math.min(minX, point.x - BALLOON_HALF_W);
    maxX = Math.max(maxX, point.x + BALLOON_HALF_W);
    minY = Math.min(minY, point.y - BALLOON_TOP);
    maxY = Math.max(maxY, point.y + 16);
  }
  return { width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/** Local extent of one arrangement, including the basket shadow. */
export function arrangementBounds(count: number, activeIndex: number) {
  const pts = placedPoints(Math.max(1, count), activeIndex);
  let minX = -40;
  let maxX = 40;
  let minY = -40;
  let maxY = BASKET_GROUND;
  for (const point of pts) {
    minX = Math.min(minX, point.x - BALLOON_HALF_W);
    maxX = Math.max(maxX, point.x + BALLOON_HALF_W);
    minY = Math.min(minY, point.y - BALLOON_TOP);
    maxY = Math.max(maxY, BASKET_GROUND);
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
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

/** Local y of the basket's ground shadow. The flight origin is the string knot. */
export const BASKET_GROUND = 30;

/**
 * Open grass above the tractor wheel and the name signs, in the library column
 * the calf cannot enter. Edges are already 16px clear of the obstacles at 1280×800.
 */
const SAFE_GRASS = { u0: 0.326, v0: 0.05, u1: 0.405, v1: 0.36 } as const;

/** How much bigger the resting bunch is than the previous grass-pocket size. */
export const REST_SIZE_BOOST = 1.5;

/**
 * Painted obstacles the resting bunch must clear.
 * Tractor includes the back wheel. Signs are the wooden name boards.
 * The cow's wander box is the roam east of the library post: the calf is
 * blocked from the post itself, so that column is the open grass.
 */
export const REST_OBSTACLES = [
  { name: "barn", u0: 0, v0: 0, u1: 0.26, v1: 0.26 },
  { name: "tractor", u0: 0.122, v0: 0.176, u1: 0.309, v1: 0.44 },
  { name: "willow", u0: 0.084, v0: 0.426, u1: 0.285, v1: 0.576 },
  { name: "finn", u0: 0.401, v0: 0.408, u1: 0.589, v1: 0.572 },
  { name: "sage", u0: 0.715, v0: 0.423, u1: 0.901, v1: 0.573 },
  { name: "cow", u0: 0.42, v0: 0.2, u1: 0.49, v1: 0.36 },
  { name: "stand", ...standArtUv() },
] as const;

/** Pixels of clearance required at a 1280-wide view. Scales with the cover fit. */
export const REST_CLEARANCE = 16;

/** Smallest on-screen star-count type. */
export const MIN_LABEL_PX = 14;

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

export type ScreenBox = { left: number; top: number; right: number; bottom: number };

export function uvBox(viewW: number, viewH: number, rect: { u0: number; v0: number; u1: number; v1: number }): ScreenBox {
  const a = screenUv(viewW, viewH, rect.u0, rect.v0);
  const b = screenUv(viewW, viewH, rect.u1, rect.v1);
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    right: Math.max(a.x, b.x),
    bottom: Math.max(a.y, b.y),
  };
}

/** Market stand, roof to the bottom of the crates, in screen pixels. */
export function standHeightPx(viewW: number, viewH: number): number {
  const box = uvBox(viewW, viewH, standArtUv());
  return box.bottom - box.top;
}

/** Grass the baskets may use. Already inset from the painted obstacles at 1280×800. */
export function safeGrassRect(viewW: number, viewH: number): ScreenBox {
  return uvBox(viewW, viewH, SAFE_GRASS);
}

/** Gap from a box to an obstacle. Positive means clear space. */
export function boxGap(box: ScreenBox, obstacle: ScreenBox): number {
  const dx = Math.max(obstacle.left - box.right, box.left - obstacle.right);
  const dy = Math.max(obstacle.top - box.bottom, box.top - obstacle.bottom);
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
  if (dx > 0) return dx;
  if (dy > 0) return dy;
  return Math.max(dx, dy);
}

export function restClearance(viewW: number, viewH: number, box: ScreenBox) {
  return REST_OBSTACLES.map((obstacle) => ({
    name: obstacle.name,
    gap: boxGap(box, uvBox(viewW, viewH, obstacle)),
  }));
}

const LABEL_BLOCK_H = 40;

function scaleThatFits(bounds: { width: number; height: number }, room: ScreenBox): number {
  const roomW = Math.max(24, room.right - room.left);
  const roomH = Math.max(24, room.bottom - room.top - LABEL_BLOCK_H);
  return Math.max(0.03, Math.min(roomW / bounds.width, roomH / bounds.height));
}

/**
 * Largest rest scale that keeps this arrangement inside the safe grass.
 * Capped at the market-stand height when the grass is tall enough.
 */
export function restScaleFor(
  viewW: number,
  viewH: number,
  count: number,
  goalsSharing = 1,
  activeIndex = 0,
): number {
  const safeCount = Math.max(1, count);
  const sharing = Math.min(BUNCH_SHOW_MAX, Math.max(1, goalsSharing));
  const grass = safeGrassRect(viewW, viewH);
  const bandH = (grass.bottom - grass.top) / sharing;
  const room = { ...grass, bottom: grass.top + bandH };
  const bounds = arrangementBounds(safeCount, Math.min(activeIndex, safeCount - 1));
  const fitted = scaleThatFits(bounds, room);
  const stand = standHeightPx(viewW, viewH);
  const forStand = stand / Math.max(1, bounds.height);
  return Math.min(fitted, forStand);
}

/** Scale that makes the focused balloon's ghost about 45% of the screen height. */
export function zoomScaleFor(viewH: number, focusScale = 1): number {
  const ghost = BALLOON_TOP * Math.max(0.35, focusScale);
  return (viewH * ZOOM_HEIGHT) / ghost;
}

export function restingScreenWidth(viewW: number, viewH: number, count: number): number {
  return bunchSpan(count).width * restScaleFor(viewW, viewH, count);
}

export function zoomScreenWidth(viewH: number, count: number, focusScale = 1): number {
  return bunchSpan(count).width * zoomScaleFor(viewH, focusScale);
}

export type GoalSeat = { x: number; y: number; scale: number };

/**
 * One seat per shown goal, stacked in a gentle arc inside the safe grass.
 * A single bunch is centered. Extra goals step up and slightly sideways.
 */
export function goalSeats(viewW: number, viewH: number, counts: number[], actives: number[] = []): GoalSeat[] {
  const shown = counts.slice(0, BUNCH_SHOW_MAX);
  if (shown.length === 0) return [];
  const grass = safeGrassRect(viewW, viewH);
  const scales = shown.map((count, index) =>
    restScaleFor(viewW, viewH, Math.max(1, count), shown.length, actives[index] ?? 0),
  );
  const scale = Math.min(...scales);
  const bandH = (grass.bottom - grass.top) / shown.length;
  return shown.map((count, index) => {
    const bounds = arrangementBounds(Math.max(1, count), actives[index] ?? 0);
    const bandTop = grass.top + index * bandH;
    const band = { ...grass, top: bandTop, bottom: bandTop + bandH };
    const boxW = bounds.width * scale;
    const boxH = bounds.height * scale;
    const spareX = Math.max(0, band.right - band.left - boxW);
    const spareY = Math.max(0, band.bottom - band.top - LABEL_BLOCK_H - boxH);
    const stagger = (index - (shown.length - 1) / 2) * Math.min(18, spareX * 0.35);
    const left = band.left + spareX / 2 + stagger;
    const top = band.top + spareY / 2;
    return {
      x: left - bounds.minX * scale,
      y: top - bounds.minY * scale,
      scale,
    };
  });
}

export function goalOverflow(goalCount: number): number {
  return Math.max(0, goalCount - BUNCH_SHOW_MAX);
}

/** Axis-aligned screen box of one resting bunch, including the label under the basket. */
export function restingBunchRect(
  viewW: number,
  viewH: number,
  count: number,
  goalsSharing = 1,
  seatIndex = 0,
  activeIndex = 0,
): ScreenBox {
  const counts = Array.from({ length: Math.max(1, goalsSharing) }, () => count);
  const actives = counts.map((_, index) => (index === seatIndex ? activeIndex : 0));
  const seats = goalSeats(viewW, viewH, counts, actives);
  const seat = seats[Math.min(seatIndex, seats.length - 1)] ?? goalSeats(viewW, viewH, [count], [activeIndex])[0]!;
  const bounds = arrangementBounds(Math.max(1, count), activeIndex);
  const left = seat.x + bounds.minX * seat.scale;
  const right = seat.x + bounds.maxX * seat.scale;
  const top = seat.y + bounds.minY * seat.scale;
  const bottom = seat.y + BASKET_GROUND * seat.scale + LABEL_BLOCK_H;
  const grass = safeGrassRect(viewW, viewH);
  const labelHalf = Math.max(28, (grass.right - grass.left) / 2 - 4);
  return {
    left: Math.min(left, Math.max(grass.left, seat.x - labelHalf)),
    top,
    right: Math.max(right, Math.min(grass.right, seat.x + labelHalf)),
    bottom,
  };
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
