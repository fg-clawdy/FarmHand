import { Graphics } from "pixi.js";
import type { CropKind } from "@farmhand/shared";

/**
 * Planted-crop seating on painted mounds.
 *
 * Crop stage sheets bake a speckled soil disc. Planted sprites use
 * `cropPlantedFrame` (disc clip + canvas elliptical soft-alpha foot) and pivot
 * at a per-kind foot anchor (not hard 0.5,1). Soft fade lifts the opaque foot
 * above the texture bottom, so anchors sit slightly above y=1 and modest
 * positive sink nests the contact into the mound. Soft contact shadow only —
 * never Graphics dirt-lip / foot-matte veils on the foliage.
 *
 * Layer order (per mound): aura (WAITING only, behind) → shadow → crop.
 * Nest Graphics may still exist at call sites but stays cleared + hidden.
 */

const BUSHY_FRUIT: ReadonlySet<CropKind> = new Set(["strawberry", "pumpkin", "tomato"]);
const TALL_THIN: ReadonlySet<CropKind> = new Set(["sunflower", "cotton", "corn"]);

/**
 * Per-kind foot pivot on the foliage-clipped planted frame.
 * Soft-alpha fade means opaque stem/fruit contact sits above texture bottom;
 * y < 1 places that contact on the mound UV with the faded fringe buried.
 */
export const PLANTED_FOOT_ANCHOR: Record<CropKind, { x: number; y: number }> = {
  // Opaque foot ≈ 0.98–1.0 of clipped frame. Bushy fruit needs a hair more hang so the
  // round bottom overlaps the mound peak (thin stems read seated sooner).
  strawberry: { x: 0.5, y: 0.90 },
  pumpkin: { x: 0.5, y: 0.92 },
  tomato: { x: 0.5, y: 0.96 },
  cotton: { x: 0.5, y: 0.98 },
  corn: { x: 0.5, y: 0.98 },
  sunflower: { x: 0.5, y: 0.98 },
};

const DEFAULT_FOOT_ANCHOR = { x: 0.5, y: 1 } as const;

export function plantedFootAnchor(kind?: CropKind | null): { x: number; y: number } {
  if (!kind) return { x: DEFAULT_FOOT_ANCHOR.x, y: DEFAULT_FOOT_ANCHOR.y };
  return PLANTED_FOOT_ANCHOR[kind] ?? { x: DEFAULT_FOOT_ANCHOR.x, y: DEFAULT_FOOT_ANCHOR.y };
}

/** Positive Y buries stem feet into the painted mound (screen Y down). */
export const CROP_SINK_FRAC = {
  // Positive bury once foot anchors sit on the opaque contact.
  // Undoes the #12 negative lift that floated bushy ripe after fruit-aware clips.
  bushy: { seed: 0.03, grow: 0.05, ripe: 0.07 },
  tall: { seed: 0.05, grow: 0.06, ripe: 0.08 },
  mid: { seed: 0.03, grow: 0.04, ripe: 0.06 },
} as const;

/** Optional per-kind sink overrides (frac of coverPx). Prefer anchors; keep these small. */
export const CROP_SINK_FRAC_BY_KIND: Partial<
  Record<CropKind, { seed: number; grow: number; ripe: number }>
> = {
  // Extra ripe bury for round fruit so the curve kisses/overlaps the mound peak.
  strawberry: { seed: 0.05, grow: 0.10, ripe: 0.22 },
  pumpkin: { seed: 0.06, grow: 0.12, ripe: 0.24 },
  tomato: { seed: 0.04, grow: 0.06, ripe: 0.10 },
  cotton: { seed: 0.06, grow: 0.08, ripe: 0.11 },
  corn: { seed: 0.05, grow: 0.06, ripe: 0.08 },
  sunflower: { seed: 0.05, grow: 0.06, ripe: 0.08 },
};

export type CropSilhouette = "bushy" | "tall" | "mid";

export function cropSilhouette(kind?: CropKind | null): CropSilhouette {
  if (!kind) return "mid";
  if (BUSHY_FRUIT.has(kind)) return "bushy";
  if (TALL_THIN.has(kind)) return "tall";
  return "mid";
}

export function cropSinkFrac(stage: 1 | 2 | 3 | 4, kind?: CropKind | null): number {
  const byKind = kind ? CROP_SINK_FRAC_BY_KIND[kind] : undefined;
  const profile = byKind ?? CROP_SINK_FRAC[cropSilhouette(kind)];
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
  // Sit at/above the stem foot (negative Y) so the umber lies under the soft-alpha
  // fringe on the mound — never a detached band below the fruit (reads as float).
  const seed = stage === 1;
  const haloA = seed ? 0.025 : 0.045;
  const coreA = seed ? 0.03 : 0.06;
  g.ellipse(0, -coverPx * 0.01, coverPx * 0.28, coverPx * 0.09);
  g.fill({ color: 0x6b4423, alpha: haloA });
  g.ellipse(0, coverPx * 0.01, coverPx * 0.15, coverPx * 0.05);
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
