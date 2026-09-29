import { Graphics } from "pixi.js";
import type { CropKind } from "@farmhand/shared";

/**
 * Planted-crop seating on painted mounds.
 *
 * Crop sheets are plant + soil disc as one unit; pivot is the disc center
 * (`cropDiscAnchor` / `CROP_DISC_IN_CELL`). Trust the painted disc — nestle
 * into the mound with a soft mound-umber contact shadow UNDER the disc only.
 * Do NOT draw an opaque speckled dirt-lip / nest oval (reads as chocolate-chip
 * cookie plate under the sticker). Soft sink is OK; never veil fruit.
 *
 * Layer order (per mound): aura (WAITING only, behind) → shadow → crop.
 * Nest Graphics may still exist at call sites but stays cleared + hidden.
 */

/** Bushy fruit sits low on the disc — modest sink so berries/pumpkin stay bright. */
const BUSHY_FRUIT: ReadonlySet<CropKind> = new Set(["strawberry", "pumpkin", "tomato"]);

/** Tall thin crops can nestle a bit more without hiding the fruit/flower. */
const TALL_THIN: ReadonlySet<CropKind> = new Set(["sunflower", "cotton", "corn"]);

/**
 * Fraction of on-screen disc cover to sink the disc center into the mound.
 * Modest — soft seat without burying ripe fruit.
 */
export const CROP_SINK_FRAC = {
  bushy: { seed: 0.045, grow: 0.055, ripe: 0.065 },
  tall: { seed: 0.085, grow: 0.12, ripe: 0.135 },
  mid: { seed: 0.06, grow: 0.085, ripe: 0.1 },
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

/** Positive Y pixels to add so the disc center sits into the painted mound. */
export function cropSinkPx(stage: 1 | 2 | 3 | 4, coverPx: number, kind?: CropKind | null): number {
  return coverPx * cropSinkFrac(stage, kind);
}

/** Aura sits up into the foliage, not ringing the disc/mound seam. */
export function approvalAuraOffsetY(coverPx: number): number {
  return -coverPx * 0.3;
}

/** True only for pending-approval WAITING plots — never for plain READY harvestables. */
export function shouldShowWaitingAura(awaitingApproval: boolean, wilted: boolean): boolean {
  return awaitingApproval && !wilted;
}

/**
 * Soft oval UNDER the disc (drawn behind the plant). Mound-matched umber,
 * soft edges, low alpha — grounds the disc without a second dark dirt plate.
 * Never over fruit pixels.
 */
export function drawContactShadow(g: Graphics, coverPx: number, stage: 1 | 2 | 3 | 4): void {
  g.clear();
  const seed = stage === 1;
  // Low-alpha mound umbers — soft falloff, no near-black cookie oval.
  const haloA = seed ? 0.05 : 0.09;
  const midA = seed ? 0.08 : 0.14;
  const coreA = seed ? 0.1 : 0.18;
  g.ellipse(0, coverPx * 0.07, coverPx * 0.56, coverPx * 0.24);
  g.fill({ color: 0x6b4423, alpha: haloA });
  g.ellipse(0, coverPx * 0.05, coverPx * 0.4, coverPx * 0.16);
  g.fill({ color: 0x7a5230, alpha: midA });
  g.ellipse(0, coverPx * 0.035, coverPx * 0.24, coverPx * 0.09);
  g.fill({ color: 0x8a5a32, alpha: coreA });
}

/**
 * Dirt-lip / nest oval DISABLED — opaque speckled Graphics ovals read as a
 * chocolate-chip cookie plate under planted stickers. Call sites may still
 * invoke this; it clears the Graphics and draws nothing.
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
