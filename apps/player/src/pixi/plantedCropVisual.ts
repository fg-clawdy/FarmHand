import { Graphics } from "pixi.js";
import type { CropKind } from "@farmhand/shared";

/**
 * Planted-crop seating on painted mounds.
 *
 * Crop sheets are plant + soil disc as one unit; pivot is the disc center
 * (`cropDiscAnchor` / `CROP_DISC_IN_CELL`). Trust the painted disc — nestle
 * into the mound, soft contact shadow UNDER the disc (behind plant), and an
 * opaque dirt lip + contact-only disc-edge camo at the stem feet. Never veil
 * fruit with a semi-transparent nest circle.
 *
 * Layer order (per mound): aura (WAITING only, behind) → shadow → crop → dirt lip.
 */

/** Bushy fruit sits low on the disc — modest sink so berries/pumpkin stay bright. */
const BUSHY_FRUIT: ReadonlySet<CropKind> = new Set(["strawberry", "pumpkin", "tomato"]);

/** Tall thin crops can nestle a bit more without hiding the fruit/flower. */
const TALL_THIN: ReadonlySet<CropKind> = new Set(["sunflower", "cotton", "corn"]);

/**
 * Fraction of on-screen disc cover to sink the disc center into the mound.
 * Modest bump vs sticker pass so painted discs read seated in lit mound dirt.
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

/** Soft oval UNDER the disc (drawn behind the plant). Never over fruit pixels. */
export function drawContactShadow(g: Graphics, coverPx: number, stage: 1 | 2 | 3 | 4): void {
  g.clear();
  const seed = stage === 1;
  // Wider, softer falloff — grounds the darker painted disc against lit mound dirt.
  const haloA = seed ? 0.1 : 0.18;
  const outerA = seed ? 0.18 : 0.32;
  const innerA = seed ? 0.24 : 0.42;
  g.ellipse(0, coverPx * 0.08, coverPx * 0.62, coverPx * 0.28);
  g.fill({ color: 0x1a0e06, alpha: haloA });
  g.ellipse(0, coverPx * 0.06, coverPx * 0.48, coverPx * 0.2);
  g.fill({ color: 0x1a0e06, alpha: outerA });
  g.ellipse(0, coverPx * 0.04, coverPx * 0.3, coverPx * 0.12);
  g.fill({ color: 0x2a1608, alpha: innerA });
}

/**
 * Opaque umber lip + contact-line disc-edge camo.
 * Covers hard painted-disc rim / stem feet only — NEVER a veil over fruit.
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
  // Wider + thicker than the sticker pass so the sharp disc rim disappears at contact.
  const w = coverPx * (bushy ? 0.58 : seed ? 0.62 : 0.66);
  const h = coverPx * (bushy ? 0.062 : seed ? 0.072 : 0.082);
  const y = coverPx * (bushy ? 0.022 : 0.03);

  // Contact-only disc-edge camo: mound-lit umbers along the bottom rim (opaque, short in Y).
  g.ellipse(0, y + h * 0.35, w * 1.05, h * 1.15);
  g.fill({ color: 0x7a5230, alpha: 0.96 });
  g.ellipse(0, y + h * 0.15, w * 0.95, h * 0.85);
  g.fill({ color: 0x6b4423, alpha: 0.98 });

  // Main opaque dirt band at the stem feet
  g.ellipse(0, y, w, h);
  g.fill({ color: 0x5c3a1c, alpha: 0.99 });
  // Lighter crest catching the mound light
  g.ellipse(0, y - h * 0.45, w * 0.82, h * 0.55);
  g.fill({ color: 0x8a5a32, alpha: 0.96 });
  // Soft warm highlight strip — blends painted disc into lit mound
  g.ellipse(0, y - h * 0.7, w * 0.55, h * 0.32);
  g.fill({ color: 0x9a6840, alpha: 0.9 });

  // Clod accents at the contact corners — stay below fruit
  g.ellipse(-w * 0.4, y + h * 0.2, w * 0.14, h * 0.6);
  g.fill({ color: 0x3d2410, alpha: 0.94 });
  g.ellipse(w * 0.38, y + h * 0.22, w * 0.12, h * 0.55);
  g.fill({ color: 0x3d2410, alpha: 0.9 });
  g.ellipse(-w * 0.12, y + h * 0.35, w * 0.1, h * 0.4);
  g.fill({ color: 0x4a2e14, alpha: 0.88 });
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
