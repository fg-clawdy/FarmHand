import type { PublicPlot } from "@farmhand/shared";
import { GARDEN_PLOT_COLS, PLOTS_PER_GARDEN } from "@farmhand/shared";
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
 * Mound UVs are pebble-ring / mound-peak centers (stem sits at the apex).
 */
export const GARDEN_ZOOM_LAYOUT = {
  sign: { u: 0.5, v: 0.145 } satisfies Uv,
  mounds: [
    { u: 0.305, v: 0.42 },
    { u: 0.5, v: 0.42 },
    { u: 0.695, v: 0.42 },
    { u: 0.305, v: 0.585 },
    { u: 0.5, v: 0.585 },
    { u: 0.695, v: 0.585 },
    { u: 0.305, v: 0.755 },
    { u: 0.5, v: 0.755 },
    { u: 0.695, v: 0.755 },
  ] as const satisfies readonly Uv[],
  /** Hit ellipse in texture pixels around each mound center. */
  hit: { rx: 110, ry: 78 } as const,
} as const;

export function gardenMoundUv(slot: number): Uv {
  const i = ((slot % PLOTS_PER_GARDEN) + PLOTS_PER_GARDEN) % PLOTS_PER_GARDEN;
  return GARDEN_ZOOM_LAYOUT.mounds[i]!;
}

export function cheapestSeedCost(tiers: readonly { seedCost: number }[]) {
  const costs = tiers.map((t) => t.seedCost).filter((n) => Number.isFinite(n));
  return costs.length ? Math.min(...costs) : 1;
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
