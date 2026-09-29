import { Graphics } from "pixi.js";
import type { CropKind } from "@farmhand/shared";

/**
 * Planted-crop seating on painted mounds.
 *
 * Crop sheets are plant + soil disc as one unit; pivot is the disc center
 * (`cropDiscAnchor` / `CROP_DISC_IN_CELL`). Trust the painted disc — slight
 * nestle into the mound, soft contact shadow UNDER the disc (behind plant),
 * and a thin opaque dirt lip at the stem feet only. Never veil fruit with a
 * semi-transparent nest circle.
 *
 * Layer order (per mound): aura (WAITING only, behind) → shadow → crop → dirt lip.
 */

/** Bushy fruit sits low on the disc — barely sink so berries/pumpkin stay bright. */
const BUSHY_FRUIT: ReadonlySet<CropKind> = new Set(["strawberry", "pumpkin", "tomato"]);

/** Tall thin crops can nestle a bit more without hiding the fruit/flower. */
const TALL_THIN: ReadonlySet<CropKind> = new Set(["sunflower", "cotton", "corn"]);

/** Fraction of on-screen disc cover to sink the disc center into the mound. */
export const CROP_SINK_FRAC = {
  bushy: { seed: 0.035, grow: 0.045, ripe: 0.05 },
  tall: { seed: 0.07, grow: 0.1, ripe: 0.11 },
  mid: { seed: 0.05, grow: 0.07, ripe: 0.08 },
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

/** Soft oval UNDER the disc (drawn behind the plant). Never over fruit pixels. */
export function drawContactShadow(g: Graphics, coverPx: number, stage: 1 | 2 | 3 | 4): void {
  g.clear();
  const seed = stage === 1;
  const outerA = seed ? 0.14 : 0.26;
  const innerA = seed ? 0.18 : 0.34;
  // Slightly below disc center so the oval reads as ground contact under the disc.
  g.ellipse(0, coverPx * 0.06, coverPx * 0.5, coverPx * 0.22);
  g.fill({ color: 0x1a0e06, alpha: outerA });
  g.ellipse(0, coverPx * 0.04, coverPx * 0.3, coverPx * 0.12);
  g.fill({ color: 0x2a1608, alpha: innerA });
}

/**
 * Thin opaque umber/clod crescent at the disc contact line.
 * Covers stem feet / very bottom underside only — NEVER a veil over fruit.
 * Prefer opaque dirt (near-1 alpha) rather than alpha-darkening plant pixels.
 */
export function drawDirtLip(
  g: Graphics,
  coverPx: number,
  stage: 1 | 2 | 3 | 4,
  kind?: CropKind | null,
): void {
  g.clear();
  const bushy = cropSilhouette(kind) === "bushy";
  const seed = stage === 1;
  // Very short in Y: contact line only. Bushy fruit gets an even thinner lip.
  const w = coverPx * (bushy ? 0.42 : seed ? 0.46 : 0.48);
  const h = coverPx * (bushy ? 0.038 : seed ? 0.045 : 0.05);
  const y = coverPx * (bushy ? 0.015 : 0.02);
  // Opaque dirt band (not a dark transparent veil)
  g.ellipse(0, y, w, h);
  g.fill({ color: 0x4a2e14, alpha: 0.98 });
  // Slightly lighter crest catching the mound
  g.ellipse(0, y - h * 0.4, w * 0.78, h * 0.55);
  g.fill({ color: 0x6b4423, alpha: 0.95 });
  // Tiny clod accents at the contact corners — stay below fruit
  g.ellipse(-w * 0.38, y + h * 0.15, w * 0.12, h * 0.55);
  g.fill({ color: 0x3a2210, alpha: 0.92 });
  g.ellipse(w * 0.36, y + h * 0.18, w * 0.1, h * 0.5);
  g.fill({ color: 0x3a2210, alpha: 0.88 });
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
