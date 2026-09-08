import { cropKindForTier, GARDEN_PLOT_COLS, PLOTS_PER_GARDEN, type PlantTier, type PublicPlot } from "@farmhand/shared";
import type { Uv } from "./playfieldLayout";

/** Zoomed garden painting (`garden_zoom_3x3.jpg`) is 1536×1024, same as the farm playfield. */
export const GARDEN_ZOOM_TEXTURE = { width: 1536, height: 1024 } as const;

export type GardenTool = "seed" | "water" | "fert";

export const GARDEN_TOOLS: GardenTool[] = ["seed", "water", "fert"];

export const GARDEN_TOOL_ART: Record<GardenTool, string> = {
  seed: "/art/painted/garden/tool_seeds.png",
  water: "/art/painted/garden/tool_water.png",
  fert: "/art/painted/garden/tool_fert.png",
};

export const GARDEN_TOOL_LABEL: Record<GardenTool, string> = {
  seed: "Seeds",
  water: "Water",
  fert: "Fertilizer",
};

/**
 * Painted pebble-ring centers on `garden_zoom_3x3.jpg` (1536×1024).
 * Texture pixels are the source of truth; UVs are those pixels / size.
 * Crops parent under the same playfield as the painting so zoom cannot drift them.
 */
export const GARDEN_MOUND_PX = [
  { x: 430, y: 317 },
  { x: 768, y: 317 },
  { x: 1106, y: 317 },
  { x: 430, y: 541 },
  { x: 768, y: 541 },
  { x: 1106, y: 541 },
  { x: 430, y: 760 },
  { x: 768, y: 760 },
  { x: 1106, y: 760 },
] as const;

function moundUvFromPx(p: { x: number; y: number }): Uv {
  return { u: p.x / GARDEN_ZOOM_TEXTURE.width, v: p.y / GARDEN_ZOOM_TEXTURE.height };
}

export const GARDEN_ZOOM_LAYOUT = {
  sign: { u: 0.5, v: 0.145 } satisfies Uv,
  mounds: GARDEN_MOUND_PX.map(moundUvFromPx),
  /** Hit ellipse in texture pixels around each mound center. */
  hit: { rx: 110, ry: 78 } as const,
} as const;

/** Garden zoom camera vs cover-fit. 0.85 pulls out so grass/fence margin stays relaxed. */
export const GARDEN_CAMERA_ZOOM = 0.85;

export function gardenMoundLocal(slot: number) {
  const i = ((slot % PLOTS_PER_GARDEN) + PLOTS_PER_GARDEN) % PLOTS_PER_GARDEN;
  return GARDEN_MOUND_PX[i]!;
}

export function gardenMoundUv(slot: number): Uv {
  return moundUvFromPx(gardenMoundLocal(slot));
}

export function cheapestSeedCost(tiers: readonly { seedCost: number }[]) {
  const costs = tiers.map((t) => t.seedCost).filter((n) => Number.isFinite(n));
  return costs.length ? Math.min(...costs) : 1;
}

const KIND_LABEL: Record<string, string> = {
  corn: "Corn",
  strawberry: "Strawberry",
  cotton: "Cotton",
};

/** Crop name for the plot sheet — never a plot index. */
export function cropNameForPlot(
  plot: Pick<PublicPlot, "tier">,
  tiers: readonly Pick<PlantTier, "tier" | "name">[],
) {
  const named = tiers.find((t) => t.tier === plot.tier)?.name?.trim();
  if (named) return named;
  return KIND_LABEL[cropKindForTier(plot.tier)] ?? "Plant";
}

export type GardenToolContext = {
  seeds: number;
  fertilizer: number;
  canWater: boolean;
  cheapestSeed: number;
};

/** Plots that can accept the selected tool right now. */
export function plotAcceptsTool(tool: GardenTool, plot: PublicPlot, ctx: GardenToolContext) {
  if (tool === "seed") return plot.state === "empty" && ctx.seeds >= ctx.cheapestSeed;
  if (plot.state !== "growing" || plot.ready) return false;
  if (tool === "water") return ctx.canWater;
  return ctx.fertilizer >= 1;
}

export function glowingSlots(
  tool: GardenTool | null,
  plots: readonly PublicPlot[],
  ctx: GardenToolContext,
) {
  if (!tool) return [];
  return plots.filter((plot) => plotAcceptsTool(tool, plot, ctx)).map((plot) => plot.slot);
}

export type GardenTap = "harvest" | "picker" | "sheet" | "water" | "fert" | "noop";

/** What a garden-zoom tap should do. READY plots always harvest — no confirm sheet. */
export function gardenTapAction(
  plot: PublicPlot,
  tool: GardenTool | null,
  ctx: GardenToolContext,
): GardenTap {
  if (plot.ready) return "harvest";
  if (tool) {
    if (!plotAcceptsTool(tool, plot, ctx)) return "noop";
    if (tool === "seed") return "picker";
    if (tool === "water") return "water";
    return "fert";
  }
  return plot.state === "empty" ? "picker" : "sheet";
}

export { GARDEN_PLOT_COLS, PLOTS_PER_GARDEN };
