import { Graphics } from "pixi.js";

/**
 * Planted-crop seating on painted mounds.
 *
 * Crop sheets are plant + soil disc as one unit; pivot is the disc center
 * (`cropDiscAnchor` / `CROP_DISC_IN_CELL`). These helpers sink that disc into
 * the mound, add a contact shadow under the sprite, and a soft dirt nest rim
 * over the disc edge so crops do not read as floating stickers.
 *
 * Layer order (per mound): aura (behind) → shadow → crop (sunk) → nest (on feet).
 * Dedicated nest-rim PNGs can replace the Graphics nest later.
 */

/** Fraction of on-screen disc cover to sink the disc center into the mound. */
export const CROP_SINK_FRAC = {
  /** Stage 1 seed pile — lighter bury. */
  seed: 0.1,
  /** Stages 2–3 growing. */
  grow: 0.14,
  /** Stage 4 ripe. */
  ripe: 0.16,
} as const;

export function cropSinkFrac(stage: 1 | 2 | 3 | 4): number {
  if (stage === 1) return CROP_SINK_FRAC.seed;
  if (stage === 4) return CROP_SINK_FRAC.ripe;
  return CROP_SINK_FRAC.grow;
}

/** Positive Y pixels to add so the disc center sits into the painted mound. */
export function cropSinkPx(stage: 1 | 2 | 3 | 4, coverPx: number): number {
  return coverPx * cropSinkFrac(stage);
}

/** Aura sits up into the foliage, not ringing the disc/mound seam. */
export function approvalAuraOffsetY(coverPx: number): number {
  return -coverPx * 0.3;
}

/** Soft oval under the disc. Stronger for ripe plants; lighter for seed piles. */
export function drawContactShadow(g: Graphics, coverPx: number, stage: 1 | 2 | 3 | 4): void {
  g.clear();
  const seed = stage === 1;
  const outerA = seed ? 0.16 : 0.3;
  const innerA = seed ? 0.22 : 0.42;
  // Slightly below disc center so the oval reads as ground contact.
  g.ellipse(0, coverPx * 0.05, coverPx * 0.56, coverPx * 0.3);
  g.fill({ color: 0x1a0e06, alpha: outerA });
  g.ellipse(0, coverPx * 0.03, coverPx * 0.36, coverPx * 0.17);
  g.fill({ color: 0x2a1608, alpha: innerA });
}

/**
 * Soft umber/clod rim over the lower disc — slightly wider than cover.
 * Nest = dirt contact, not a glow. Drawn ABOVE the crop sprite feet.
 */
export function drawSoilNest(g: Graphics, coverPx: number, stage: 1 | 2 | 3 | 4): void {
  g.clear();
  const seed = stage === 1;
  const w = coverPx * (seed ? 0.54 : 0.58);
  const h = coverPx * (seed ? 0.2 : 0.24);
  const y = coverPx * 0.08;
  // Outer soft dirt halo
  g.ellipse(0, y + h * 0.2, w * 1.12, h * 1.1);
  g.fill({ color: 0x3d2412, alpha: seed ? 0.22 : 0.32 });
  // Main clod rim
  g.ellipse(0, y, w, h);
  g.fill({ color: 0x6b4423, alpha: seed ? 0.3 : 0.42 });
  // Lighter soil crest catching the disc edge
  g.ellipse(0, y - h * 0.28, w * 0.78, h * 0.55);
  g.fill({ color: 0x8a5a32, alpha: seed ? 0.2 : 0.28 });
  // Small darker clod accents (no glow)
  g.ellipse(-w * 0.35, y + h * 0.05, w * 0.18, h * 0.35);
  g.fill({ color: 0x2e1a0c, alpha: 0.22 });
  g.ellipse(w * 0.32, y + h * 0.08, w * 0.16, h * 0.3);
  g.fill({ color: 0x2e1a0c, alpha: 0.18 });
}

/** Purple waiting aura sized to cover; caller places it behind the plant sprite. */
export function drawWaitingAura(g: Graphics, coverPx: number, scale = 1): void {
  g.clear();
  const rx = coverPx * 0.52 * scale;
  const ry = coverPx * 0.3 * scale;
  g.ellipse(0, 0, rx * 1.15, ry * 1.15);
  g.fill({ color: 0x9b5cff, alpha: 0.22 });
  g.ellipse(0, -coverPx * 0.02, rx * 0.9, ry * 0.9);
  g.fill({ color: 0xb57bff, alpha: 0.4 });
  g.ellipse(0, -coverPx * 0.04, rx * 0.62, ry * 0.62);
  g.fill({ color: 0xd8b4ff, alpha: 0.36 });
  g.ellipse(0, -coverPx * 0.05, rx * 0.35, ry * 0.35);
  g.fill({ color: 0xf3e8ff, alpha: 0.3 });
}
