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
 * UV layout on the zoomed 3×3 garden painting.
 * Regular 3×3 on the painted pebble-ring centers (stem at the apex).
 */
export const GARDEN_ZOOM_LAYOUT = {
  sign: { u: 0.5, v: 0.145 } satisfies Uv,
  mounds: [
    { u: 0.28, v: 0.31 },
    { u: 0.5, v: 0.31 },
    { u: 0.72, v: 0.31 },
    { u: 0.28, v: 0.528 },
    { u: 0.5, v: 0.528 },
    { u: 0.72, v: 0.528 },
    { u: 0.28, v: 0.742 },
    { u: 0.5, v: 0.742 },
    { u: 0.72, v: 0.742 },
  ] as const satisfies readonly Uv[],
  /** Hit ellipse in texture pixels around each mound center. */
  hit: { rx: 110, ry: 78 } as const,
} as const;

/** Garden zoom camera vs cover-fit. 0.9 pulls out so the full fence stays in view. */
export const GARDEN_CAMERA_ZOOM = 0.9;

export function gardenMoundUv(slot: number): Uv {
  const i = ((slot % PLOTS_PER_GARDEN) + PLOTS_PER_GARDEN) % PLOTS_PER_GARDEN;
  return GARDEN_ZOOM_LAYOUT.mounds[i]!;
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

export { GARDEN_PLOT_COLS, PLOTS_PER_GARDEN };
