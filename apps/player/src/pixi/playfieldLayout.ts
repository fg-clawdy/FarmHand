/**
 * UV anchors on `farmhand_painted_playfield_v2_blank_signs.jpg` (1536×1024).
 * Values are fractions of the texture (not the screen). Cover-fit the painting
 * and multiply by texture width/height to get local pixels.
 *
 * Measured on the v2 blank-sign painting:
 *   exhaust tip  ~ (430, 326)  = UV (0.280, 0.318)  — top of the vertical pipe
 *   left sign    ~ (250, 496)  = UV (0.163, 0.484)
 *   center sign  ~ (760, 492)  = UV (0.495, 0.480)
 *   right sign   ~ (1221, 496) = UV (0.795, 0.484)
 *
 * A static Holstein is baked into the grass near the barn. The animated cow
 * starts on top of that spot; a slight double is accepted for v1.
 */

export type Uv = { u: number; v: number };
export type UvRect = { u0: number; v0: number; u1: number; v1: number };
export type PixelRect = { x0: number; y0: number; x1: number; y1: number };

export const PLAYFIELD_TEXTURE = { width: 1536, height: 1024 } as const;

export const PLAYFIELD_LAYOUT = {
  exhaustTip: { u: 0.28, v: 0.318 } satisfies Uv,
  cowStart: { u: 0.4, v: 0.26 } satisfies Uv,
  /** Grass between the barn and the garden signs — stays above the plots. */
  cowRoam: { u0: 0.2, v0: 0.22, u1: 0.6, v1: 0.4 } satisfies UvRect,
  storeHit: { u0: 0.68, v0: 0.02, u1: 0.97, v1: 0.36 } satisfies UvRect,
  gardens: [
    {
      hit: { u0: 0.04, v0: 0.42, u1: 0.3, v1: 0.88 } satisfies UvRect,
      sign: { u: 0.163, v: 0.484 } satisfies Uv,
    },
    {
      hit: { u0: 0.36, v0: 0.42, u1: 0.64, v1: 0.88 } satisfies UvRect,
      sign: { u: 0.495, v: 0.48 } satisfies Uv,
    },
    {
      hit: { u0: 0.68, v0: 0.42, u1: 0.97, v1: 0.88 } satisfies UvRect,
      sign: { u: 0.795, v: 0.484 } satisfies Uv,
    },
  ],
} as const;

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

export function cowRoamAvoidsGardens(
  roam: UvRect = PLAYFIELD_LAYOUT.cowRoam,
  gardens: readonly { hit: UvRect }[] = PLAYFIELD_LAYOUT.gardens,
) {
  return gardens.every((garden) => !rectsOverlap(roam, garden.hit));
}

export function gardenSignName(name: string) {
  return name.trim() || "Garden";
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
) {
  for (let i = 0; i < 16; i++) {
    const x = roam.x0 + rand() * (roam.x1 - roam.x0);
    const y = roam.y0 + rand() * (roam.y1 - roam.y0);
    if (!forbidden.some((rect) => pointInRect(x, y, rect))) return { x, y };
  }
  return { x: (roam.x0 + roam.x1) / 2, y: (roam.y0 + roam.y1) / 2 };
}
