/**
 * UV anchors on `farmhand_painted_playfield_v2_blank_signs.jpg` (1536×1024).
 * Values are fractions of the texture (not the screen). Cover-fit the painting
 * and multiply by texture width/height to get local pixels.
 *
 * Measured on the v2 blank-sign painting:
 *   exhaust tip  ~ (419, 258)  = UV (0.273, 0.252)  — mouth at the TOP of the
 *     vertical stack (the black pipe on the tractor hood, upper-left cluster).
 *     Not the pipe base on the red body (~430, 326). Smoke puffs rise from here.
 *   left sign    ~ (250, 496)  = UV (0.163, 0.484)
 *   center sign  ~ (760, 492)  = UV (0.495, 0.480)
 *   right sign   ~ (1221, 496) = UV (0.795, 0.484)
 *
 * A static Holstein / mama cow is baked into the grass. The animated calf
 * starts on a clear patch beside her and treats her (plus barn, tractor, hay,
 * market stand, and garden fences) as solid blockers.
 */

export type Uv = { u: number; v: number };
export type UvRect = { u0: number; v0: number; u1: number; v1: number };
export type PixelRect = { x0: number; y0: number; x1: number; y1: number };

export const PLAYFIELD_TEXTURE = { width: 1536, height: 1024 } as const;

export const PLAYFIELD_LAYOUT = {
  /** Mouth of the tractor’s vertical exhaust stack (texture px 419, 258). */
  exhaustTip: { u: 0.273, v: 0.252 } satisfies Uv,
  /** Clear grass left of the baked mama cow, below the tractor, above the fences. */
  cowStart: { u: 0.28, v: 0.388 } satisfies Uv,
  /** Barn-side meadow — stays above the garden fence line; props are holes. */
  cowRoam: { u0: 0.06, v0: 0.12, u1: 0.58, v1: 0.4 } satisfies UvRect,
  storeHit: { u0: 0.68, v0: 0.02, u1: 0.97, v1: 0.36 } satisfies UvRect,
  /** Solid footprints the roaming cow must weave around (plus garden hits). */
  blockers: {
    barn: { u0: 0.02, v0: 0.0, u1: 0.24, v1: 0.22 } satisfies UvRect,
    hay: { u0: 0.0, v0: 0.08, u1: 0.12, v1: 0.24 } satisfies UvRect,
    tractor: { u0: 0.2, v0: 0.16, u1: 0.36, v1: 0.36 } satisfies UvRect,
    mamaCow: { u0: 0.34, v0: 0.18, u1: 0.5, v1: 0.34 } satisfies UvRect,
    stand: { u0: 0.66, v0: 0.0, u1: 0.98, v1: 0.38 } satisfies UvRect,
  },
  gardens: [
    {
      hit: { u0: 0.04, v0: 0.42, u1: 0.3, v1: 0.88 } satisfies UvRect,
      sign: { u: 0.163, v: 0.484 } satisfies Uv,
      soil: { u0: 0.07, v0: 0.62, u1: 0.27, v1: 0.86 } satisfies UvRect,
    },
    {
      hit: { u0: 0.36, v0: 0.42, u1: 0.64, v1: 0.88 } satisfies UvRect,
      sign: { u: 0.495, v: 0.48 } satisfies Uv,
      soil: { u0: 0.39, v0: 0.62, u1: 0.61, v1: 0.86 } satisfies UvRect,
    },
    {
      hit: { u0: 0.68, v0: 0.42, u1: 0.97, v1: 0.88 } satisfies UvRect,
      sign: { u: 0.795, v: 0.484 } satisfies Uv,
      soil: { u0: 0.71, v0: 0.62, u1: 0.93, v1: 0.86 } satisfies UvRect,
    },
  ],
} as const;

/** Painted gardens are 3×3 mounds; gameplay uses 6 slots on the front two rows. */
export const MOUND_COLS = 3;
export const PLAYABLE_PLOT_SLOTS = 6;

export function moundUv(soil: UvRect, slot: number): Uv {
  const col = ((slot % MOUND_COLS) + MOUND_COLS) % MOUND_COLS;
  const row = Math.min(1, Math.floor(Math.max(0, slot) / MOUND_COLS));
  return {
    u: soil.u0 + ((col + 0.5) / MOUND_COLS) * (soil.u1 - soil.u0),
    v: soil.v0 + ((row + 0.5) / 2) * (soil.v1 - soil.v0),
  };
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
const BLOCKER_PAD = 0.014;

export function cowForbiddenUv(
  layout: typeof PLAYFIELD_LAYOUT = PLAYFIELD_LAYOUT,
  pad: number = BLOCKER_PAD,
): UvRect[] {
  return [
    layout.blockers.barn,
    layout.blockers.hay,
    layout.blockers.tractor,
    layout.blockers.mamaCow,
    layout.blockers.stand,
    ...layout.gardens.map((garden) => garden.hit),
  ].map((rect) => padUvRect(rect, pad));
}

export function cowForbiddenRects(texW: number, texH: number): PixelRect[] {
  return cowForbiddenUv().map((rect) => uvRectToLocal(rect, texW, texH));
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
  return forbidden.some((rect) => segmentHitsRect(x0, y0, x1, y1, rect));
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
    if (forbidden.some((rect) => pointInRect(x, y, rect))) continue;
    if (from && pathHitsForbidden(from.x, from.y, x, y, forbidden)) continue;
    return { x, y };
  }
  for (let i = 0; i < 28; i++) {
    const x = roam.x0 + rand() * (roam.x1 - roam.x0);
    const y = roam.y0 + rand() * (roam.y1 - roam.y0);
    if (!forbidden.some((rect) => pointInRect(x, y, rect))) return { x, y };
  }
  return { x: roam.x0 + 12, y: roam.y1 - 12 };
}
