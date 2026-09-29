import { Graphics } from "pixi.js";
import type { CropKind } from "@farmhand/shared";

/**
 * Planted-crop seating on painted mounds.
 *
 * Crop stage sheets bake a speckled soil disc under the plant. Planted sprites
 * keep the full stage frame (disc pivot) but apply `drawPlantedFoliageMask` so
 * the cookie is clipped off and foliage+stem roots into the mound. Soft
 * mound-umber contact shadow under the feet — never an opaque dirt-lip oval.
 *
 * Layer order (per mound): aura (WAITING only, behind) → shadow → crop.
 * Nest Graphics may still exist at call sites but stays cleared + hidden.
 */

/** Bushy fruit sits low — modest sink so berries/pumpkin stay bright. */
const BUSHY_FRUIT: ReadonlySet<CropKind> = new Set(["strawberry", "pumpkin", "tomato"]);

/** Tall thin crops can nestle a bit more without hiding the fruit/flower. */
const TALL_THIN: ReadonlySet<CropKind> = new Set(["sunflower", "cotton", "corn"]);

/**
 * Fraction of on-screen disc cover to sink stem feet into the mound.
 * Modest — soft seat without burying ripe fruit.
 */
/** Mask foot as fraction of cover; also added into cropSinkPx so cutoff sits in mound. */
export const PLANTED_MASK_FOOT_FRAC = 0.42;

export const CROP_SINK_FRAC = {
  bushy: { seed: 0.04, grow: 0.05, ripe: 0.06 },
  tall: { seed: 0.06, grow: 0.08, ripe: 0.1 },
  mid: { seed: 0.05, grow: 0.065, ripe: 0.08 },
} as const;

export type CropSilhouette = "bushy" | "tall" | "mid";

export function cropSilhouette(kind?: CropKind | null): CropSilhouette {
  if (!kind) return "mid";
  if (BUSHY_FRUIT.has(kind)) return "bushy";
  if (TALL_THIN.has(kind)) return "tall";
  return "mid";
}

export function cropSinkFrac(stage: 1 | 2 | 3 | 4, kind?: CropKind | null): number {
  const profile = CROP_SINK_FRAC[cropSilhouette(kind)];
  if (stage === 1) return profile.seed;
  if (stage === 4) return profile.ripe;
  return profile.grow;
}

/**
 * Positive Y so the foliage-mask foot (stem cutoff) sits in the painted mound.
 * Includes PLANTED_MASK_FOOT_FRAC so the hard mask edge is buried in mound dirt.
 */
export function cropSinkPx(stage: 1 | 2 | 3 | 4, coverPx: number, kind?: CropKind | null): number {
  return coverPx * (cropSinkFrac(stage, kind) + PLANTED_MASK_FOOT_FRAC);
}

/** Aura sits up into the foliage, not ringing the mound seam. */
export function approvalAuraOffsetY(coverPx: number): number {
  return -coverPx * 0.45;
}

/** True only for pending-approval WAITING plots — never for plain READY harvestables. */
export function shouldShowWaitingAura(awaitingApproval: boolean, wilted: boolean): boolean {
  return awaitingApproval && !wilted;
}

/**
 * Plant tint. Healthy stays white — baked disc is clipped off, so warm disc
 * multiply is no longer needed. Wilted/waiting keep their cues.
 */
export function plantedDiscTint(wilted: boolean, awaiting: boolean): number {
  if (wilted) return 0x8a8a8a;
  if (awaiting) return 0xe8d7ff;
  return 0xffffff;
}

/**
 * Soft oval under stem feet (drawn behind the plant). Mound-matched umber,
 * soft edges, low alpha — grounds the plant without a second dark dirt plate.
 */
export function drawContactShadow(g: Graphics, coverPx: number, stage: 1 | 2 | 3 | 4): void {
  g.clear();
  const seed = stage === 1;
  const haloA = seed ? 0.06 : 0.11;
  const midA = seed ? 0.1 : 0.16;
  const coreA = seed ? 0.12 : 0.2;
  g.ellipse(0, coverPx * 0.04, coverPx * 0.5, coverPx * 0.2);
  g.fill({ color: 0x6b4423, alpha: haloA });
  g.ellipse(0, coverPx * 0.025, coverPx * 0.34, coverPx * 0.12);
  g.fill({ color: 0x7a5230, alpha: midA });
  g.ellipse(0, coverPx * 0.015, coverPx * 0.2, coverPx * 0.07);
  g.fill({ color: 0x8a5a32, alpha: coreA });
}

/**
 * Mask for a disc-anchored planted sprite: reveal foliage+stem, hide the baked
 * soil cookie below the stem feet. Bottom edge is a wide shallow ellipse so the
 * cut follows the mound instead of a hard scissor bar.
 *
 * Local space assumes plant.anchor = cropDiscAnchor (disc center at 0,0).
 */
export function drawPlantedFoliageMask(g: Graphics, coverPx: number): void {
  g.clear();
  const top = -coverPx * 2.4;
  // Cookie top ≈ discCenter - 0.4*discDiameter. Hide everything at/below that.
  const foot = -coverPx * PLANTED_MASK_FOOT_FRAC;
  const halfW = coverPx * 0.78;
  // Chimney up through foliage; rounded foot sits on the mound, not the cookie.
  g.moveTo(-halfW, top);
  g.lineTo(halfW, top);
  g.lineTo(halfW * 1.02, foot - coverPx * 0.04);
  g.quadraticCurveTo(0, foot + coverPx * 0.06, -halfW * 1.02, foot - coverPx * 0.04);
  g.closePath();
  g.fill({ color: 0xffffff });
}

/**
 * Dirt-lip / nest oval DISABLED — opaque speckled Graphics ovals read as a
 * chocolate-chip cookie plate. Call sites may still invoke; clears only.
 */
export function drawDirtLip(
  g: Graphics,
  _coverPx: number,
  _stage: 1 | 2 | 3 | 4,
  _kind?: CropKind | null,
): void {
  g.clear();
}

/** @deprecated use drawDirtLip — kept so older call sites rename cleanly. */
export const drawSoilNest = drawDirtLip;

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
