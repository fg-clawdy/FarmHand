import { GARDEN_PLOT_COLS, PLOTS_PER_GARDEN } from "@farmhand/shared";

/**
 * UV anchors on `farmhand_painted_playfield_v3_no_static_cow.jpg` (1536×1024).
 * Values are fractions of the texture (not the screen). Cover-fit the painting
 * and multiply by texture width/height to get local pixels.
 *
 * Measured on the v3 painting (no baked Holstein):
 *   exhaust tip  ~ (419, 258)  = UV (0.273, 0.252)  — mouth at the TOP of the
 *     vertical stack (the black pipe on the tractor hood).
 *   left sign    ~ (250, 496)  = UV (0.163, 0.484)
 *   center sign  ~ (760, 492)  = UV (0.495, 0.480)
 *   right sign   ~ (1221, 496) = UV (0.795, 0.484)
 *
 * Only the animated cow is drawn. Barn, tractor, hay, market stand, and the
 * three garden fences (full 3×3 soil + plaques) are solid blockers.
 */

export type Uv = { u: number; v: number };
export type UvRect = { u0: number; v0: number; u1: number; v1: number };
export type PixelRect = { x0: number; y0: number; x1: number; y1: number };

export const PLAYFIELD_TEXTURE = { width: 1536, height: 1024 } as const;

export const PLAYFIELD_LAYOUT = {
  /** Mouth of the tractor’s vertical exhaust stack (texture px 419, 258). */
  exhaustTip: { u: 0.273, v: 0.252 } satisfies Uv,
  /** Open grass right of the tractor, above the garden fences. */
  cowStart: { u: 0.5, v: 0.3 } satisfies Uv,
  /** Barn-side corridor — stays above the garden fence / plaque line. */
  cowRoam: { u0: 0.12, v0: 0.2, u1: 0.6, v1: 0.36 } satisfies UvRect,
  storeHit: { u0: 0.64, v0: 0.02, u1: 0.98, v1: 0.38 } satisfies UvRect,
  /** Solid footprints — tractor chassis is intentionally large so the calf cannot climb the hood. */
  blockers: {
    barn: { u0: 0.0, v0: 0.0, u1: 0.26, v1: 0.26 } satisfies UvRect,
    hay: { u0: 0.0, v0: 0.08, u1: 0.14, v1: 0.28 } satisfies UvRect,
    tractor: { u0: 0.14, v0: 0.1, u1: 0.4, v1: 0.38 } satisfies UvRect,
    stand: { u0: 0.64, v0: 0.0, u1: 0.99, v1: 0.4 } satisfies UvRect,
  },
  gardens: [
    {
      hit: { u0: 0.02, v0: 0.4, u1: 0.32, v1: 0.9 } satisfies UvRect,
      sign: { u: 0.163, v: 0.484 } satisfies Uv,
      soil: { u0: 0.09, v0: 0.62, u1: 0.27, v1: 0.78 } satisfies UvRect,
      /** Clawdy white-peak approved (home playfield, 1536×1024). */
      mounds: [
        { u: 0.1133, v: 0.6289 },
        { u: 0.1751, v: 0.6299 },
        { u: 0.2396, v: 0.6309 },
        { u: 0.1042, v: 0.6855 },
        { u: 0.168, v: 0.6855 },
        { u: 0.2344, v: 0.6885 },
        { u: 0.0924, v: 0.748 },
        { u: 0.1608, v: 0.748 },
        { u: 0.2285, v: 0.7471 },
      ] as const satisfies readonly Uv[],
    },
    {
      hit: { u0: 0.34, v0: 0.4, u1: 0.66, v1: 0.9 } satisfies UvRect,
      sign: { u: 0.495, v: 0.48 } satisfies Uv,
      soil: { u0: 0.41, v0: 0.62, u1: 0.59, v1: 0.78 } satisfies UvRect,
      /** Clawdy white-peak approved (home playfield, 1536×1024). */
      mounds: [
        { u: 0.4284, v: 0.6299 },
        { u: 0.4935, v: 0.6328 },
        { u: 0.5592, v: 0.6309 },
        { u: 0.4258, v: 0.6885 },
        { u: 0.4941, v: 0.6855 },
        { u: 0.5618, v: 0.6855 },
        { u: 0.4238, v: 0.7451 },
        { u: 0.4948, v: 0.7461 },
        { u: 0.5612, v: 0.7461 },
      ] as const satisfies readonly Uv[],
    },
    {
      hit: { u0: 0.66, v0: 0.4, u1: 0.99, v1: 0.9 } satisfies UvRect,
      sign: { u: 0.795, v: 0.484 } satisfies Uv,
      soil: { u0: 0.72, v0: 0.62, u1: 0.91, v1: 0.78 } satisfies UvRect,
      /** Clawdy white-peak approved (home playfield, 1536×1024). */
      mounds: [
        { u: 0.7461, v: 0.6289 },
        { u: 0.8099, v: 0.6289 },
        { u: 0.8711, v: 0.6328 },
        { u: 0.752, v: 0.6885 },
        { u: 0.8203, v: 0.6895 },
        { u: 0.8822, v: 0.6865 },
        { u: 0.7591, v: 0.752 },
        { u: 0.8281, v: 0.75 },
        { u: 0.8945, v: 0.749 },
      ] as const satisfies readonly Uv[],
    },
  ],
} as const;

/** Painted gardens are a full 3×3 of plantable mounds. */
export const MOUND_COLS = GARDEN_PLOT_COLS;
export const PLAYABLE_PLOT_SLOTS = PLOTS_PER_GARDEN;

export function moundUv(garden: { mounds: readonly Uv[] }, slot: number): Uv {
  const i = ((slot % PLOTS_PER_GARDEN) + PLOTS_PER_GARDEN) % PLOTS_PER_GARDEN;
  return garden.mounds[i]!;
}

/** Ready-harvest sparkles sit on each ready mound UV — never the soil-rect center. */
export function readySparkleSeats(
  garden: { mounds: readonly Uv[]; soil: UvRect },
  plots: Array<{ slot: number; ready?: boolean } | null | undefined> | undefined,
): Array<{ slot: number; uv: Uv }> {
  return (plots ?? [])
    .filter((plot): plot is { slot: number; ready?: boolean } => Boolean(plot?.ready))
    .map((plot) => ({ slot: plot.slot, uv: moundUv(garden, plot.slot) }));
}

export function soilRectCenterUv(soil: UvRect): Uv {
  return { u: (soil.u0 + soil.u1) / 2, v: (soil.v0 + soil.v1) / 2 };
}

export function uvToLocal(uv: Uv, texW: number, texH: number) {
  return { x: uv.u * texW, y: uv.v * texH };
}

export function uvRectToLocal(rect: UvRect, texW: number, texH: number): PixelRect {
  return {
    x0: rect.u0 * texW,
    y0: rect.v0 * texH,
    x1: rect.u1 * texW,
    y1: rect.v1 * texH,
  };
}

export function rectsOverlap(a: UvRect, b: UvRect) {
  return a.u0 < b.u1 && a.u1 > b.u0 && a.v0 < b.v1 && a.v1 > b.v0;
}

export function pointInRect(x: number, y: number, rect: PixelRect) {
  return x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1;
}

export function padUvRect(rect: UvRect, pad: number): UvRect {
  return { u0: rect.u0 - pad, v0: rect.v0 - pad, u1: rect.u1 + pad, v1: rect.v1 + pad };
}

/** Extra padding so the cow’s body (pivot at feet) does not clip a prop. */
const BLOCKER_PAD = 0.022;

/** On-field calf size in playfield pixels. Collision uses this, not just the hooves. */
export const COW_ON_FIELD = { height: 88, halfW: 70, below: 6 } as const;

export function cowForbiddenUv(
  layout: typeof PLAYFIELD_LAYOUT = PLAYFIELD_LAYOUT,
  pad: number = BLOCKER_PAD,
): UvRect[] {
  return [
    layout.blockers.barn,
    layout.blockers.hay,
    layout.blockers.tractor,
    layout.blockers.stand,
    ...layout.gardens.map((garden) => garden.hit),
  ].map((rect) => padUvRect(rect, pad));
}

export function cowForbiddenRects(texW: number, texH: number): PixelRect[] {
  return cowForbiddenUv().map((rect) => uvRectToLocal(rect, texW, texH));
}

export function cowBodyRect(x: number, y: number): PixelRect {
  return {
    x0: x - COW_ON_FIELD.halfW,
    y0: y - COW_ON_FIELD.height,
    x1: x + COW_ON_FIELD.halfW,
    y1: y + COW_ON_FIELD.below,
  };
}

export function pixelRectsOverlap(a: PixelRect, b: PixelRect) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function cowBodyHitsForbidden(x: number, y: number, forbidden: readonly PixelRect[]) {
  const body = cowBodyRect(x, y);
  return forbidden.some((rect) => pixelRectsOverlap(body, rect));
}

export function segmentsIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
) {
  const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (den === 0) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function segmentHitsRect(x0: number, y0: number, x1: number, y1: number, rect: PixelRect) {
  if (pointInRect(x0, y0, rect) || pointInRect(x1, y1, rect)) return true;
  return (
    segmentsIntersect(x0, y0, x1, y1, rect.x0, rect.y0, rect.x1, rect.y0) ||
    segmentsIntersect(x0, y0, x1, y1, rect.x1, rect.y0, rect.x1, rect.y1) ||
    segmentsIntersect(x0, y0, x1, y1, rect.x1, rect.y1, rect.x0, rect.y1) ||
    segmentsIntersect(x0, y0, x1, y1, rect.x0, rect.y1, rect.x0, rect.y0)
  );
}

export function pathHitsForbidden(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  forbidden: readonly PixelRect[],
) {
  if (cowBodyHitsForbidden(x1, y1, forbidden)) return true;
  if (forbidden.some((rect) => segmentHitsRect(x0, y0, x1, y1, rect))) return true;
  for (let t = 0.25; t < 1; t += 0.25) {
    if (cowBodyHitsForbidden(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, forbidden)) return true;
  }
  return false;
}

export function cowRoamAvoidsGardens(
  roam: UvRect = PLAYFIELD_LAYOUT.cowRoam,
  gardens: readonly { hit: UvRect }[] = PLAYFIELD_LAYOUT.gardens,
) {
  return gardens.every((garden) => !rectsOverlap(roam, garden.hit));
}

export function gardenSignName(name: string) {
  return name.trim() || "Garden";
}

export function gardenSignStats(seeds: number, points: number) {
  return `${seeds} seeds · ${points} pts`;
}

/**
 * The cow sheet faces right only. Negative travel means flip with scale.x = -1.
 * Zero dx keeps the current facing (idle / mostly-vertical steps).
 */
export function facingFromDx(dx: number, current: 1 | -1 = 1): 1 | -1 {
  if (dx < 0) return -1;
  if (dx > 0) return 1;
  return current;
}

export function pickRoamTarget(
  roam: PixelRect,
  forbidden: readonly PixelRect[],
  rand: () => number = Math.random,
  from?: { x: number; y: number },
) {
  for (let i = 0; i < 28; i++) {
    const x = roam.x0 + rand() * (roam.x1 - roam.x0);
    const y = roam.y0 + rand() * (roam.y1 - roam.y0);
    if (cowBodyHitsForbidden(x, y, forbidden)) continue;
    if (from && pathHitsForbidden(from.x, from.y, x, y, forbidden)) continue;
    return { x, y };
  }
  for (let i = 0; i < 28; i++) {
    const x = roam.x0 + rand() * (roam.x1 - roam.x0);
    const y = roam.y0 + rand() * (roam.y1 - roam.y0);
    if (!cowBodyHitsForbidden(x, y, forbidden)) return { x, y };
  }
  return { x: roam.x1 - 24, y: roam.y1 - 16 };
}
