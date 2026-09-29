import { Graphics } from "pixi.js";
import type { CropKind } from "@farmhand/shared";

/**
 * Planted-crop seating on painted mounds.
 *
 * Crop stage sheets bake a speckled soil disc. Planted sprites use
 * `cropPlantedFrame` (disc clip + canvas elliptical soft-alpha foot) and pivot
 * at stem feet (anchor 0.5,1). Soft low-alpha contact shadow behind the plant —
 * never Graphics dirt-lip / foot-matte veils on the foliage.
 *
 * Layer order (per mound): aura (WAITING only, behind) → shadow → crop.
 * Nest Graphics may still exist at call sites but stays cleared + hidden.
 */

const BUSHY_FRUIT: ReadonlySet<CropKind> = new Set(["strawberry", "pumpkin", "tomato"]);
const TALL_THIN: ReadonlySet<CropKind> = new Set(["sunflower", "cotton", "corn"]);

export const CROP_SINK_FRAC = {
  // Soft-alpha foot dissolves into mound — modest sink, no sticker float.
  bushy: { seed: 0.08, grow: 0.11, ripe: 0.14 },
  tall: { seed: 0.1, grow: 0.14, ripe: 0.17 },
  mid: { seed: 0.09, grow: 0.12, ripe: 0.15 },
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

/** Positive Y so stem feet of the foliage frame sit into the painted mound. */
export function cropSinkPx(stage: 1 | 2 | 3 | 4, coverPx: number, kind?: CropKind | null): number {
  return coverPx * cropSinkFrac(stage, kind);
}

export function approvalAuraOffsetY(coverPx: number): number {
  return -coverPx * 0.45;
}

export function shouldShowWaitingAura(awaitingApproval: boolean, wilted: boolean): boolean {
  return awaitingApproval && !wilted;
}

export function plantedDiscTint(wilted: boolean, awaiting: boolean): number {
  if (wilted) return 0x8a8a8a;
  if (awaiting) return 0xe8d7ff;
  return 0xffffff;
}

export function drawContactShadow(g: Graphics, coverPx: number, stage: 1 | 2 | 3 | 4): void {
  g.clear();
  // Sit BELOW the translucent soft-alpha foot so umber never shows through leaves.
  const seed = stage === 1;
  const haloA = seed ? 0.025 : 0.04;
  const coreA = seed ? 0.03 : 0.055;
  g.ellipse(0, coverPx * 0.08, coverPx * 0.26, coverPx * 0.08);
  g.fill({ color: 0x6b4423, alpha: haloA });
  g.ellipse(0, coverPx * 0.1, coverPx * 0.14, coverPx * 0.045);
  g.fill({ color: 0x8a5a32, alpha: coreA });
}

/** @deprecated unused — hard Graphics masks scissors soft canvas fades. */
export function drawPlantedFootMask(g: Graphics, _frameW: number, _frameH: number): void {
  g.clear();
}

/** @deprecated removed — flat umber veils painted a tan band on leaves. */
export function drawFootMatte(g: Graphics, _coverPx: number, _stage: 1 | 2 | 3 | 4): void {
  g.clear();
}

export function drawDirtLip(
  g: Graphics,
  _coverPx: number,
  _stage: 1 | 2 | 3 | 4,
  _kind?: CropKind | null,
): void {
  g.clear();
}

export const drawSoilNest = drawDirtLip;

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
