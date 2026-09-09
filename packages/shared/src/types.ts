export const MASCOTS = ["cow", "chicken", "pig", "sheep", "horse"] as const;
export type Mascot = (typeof MASCOTS)[number];

export const MASCOT_EMOJI: Record<Mascot, string> = {
  cow: "🐄",
  chicken: "🐔",
  pig: "🐷",
  sheep: "🐑",
  horse: "🐴",
};

export const INGREDIENT_IDS = ["moonDew", "growGoo", "phoenixAsh"] as const;
export type IngredientId = (typeof INGREDIENT_IDS)[number];

export type PlotState = "empty" | "growing" | "mature" | "purgatory" | "wilted";
export type PlotPhase = "empty" | "growing" | "purgatory" | "wilted";

/** Each child’s garden is a painted 3×3 of plantable mounds. */
export const GARDEN_PLOT_COLS = 3;
export const PLOTS_PER_GARDEN = 9;

export const CROP_KINDS = ["corn", "strawberry", "cotton"] as const;
export type CropKind = (typeof CROP_KINDS)[number];

export function cropKindForTier(tier: number | null | undefined): CropKind {
  const index = Math.max(0, (tier ?? 1) - 1);
  return CROP_KINDS[Math.min(index, CROP_KINDS.length - 1)] ?? "corn";
}

export type PlantTier = {
  tier: number;
  kind: CropKind;
  emoji: string;
  name: string;
  seedCost: number;
  durationMinutes: number;
  points: number;
  fertilizerReductionMinutes: number;
  stages: [string, string, string, string];
  faces: [string, string, string, string];
};

export type IngredientDef = {
  id: IngredientId;
  name: string;
  emoji: string;
};

export type GameConfig = {
  timezone: string;
  sessionMinutes: number;
  startingSeeds: number;
  startingPoints: number;
  startingFertilizer: number;
  wateringCooldownMinutes: number;
  wateringMaxPerDay: number;
  wateringReductionMinutes: number;
  harvestSeedReturn: number;
  plotCount: number;
  mixYield: number;
  /** Parent-authored “what good play looks like” for AI balance review. */
  balanceGoals: string;
  ingredients: IngredientDef[];
  tiers: PlantTier[];
};

export type PublicPlot = {
  slot: number;
  state: PlotState;
  tier: number | null;
  plantedAt: string | null;
  maturesAt: string | null;
  remainingMs: number;
  growthStage: 1 | 2 | 3 | 4 | null;
  emoji: string | null;
  face: string | null;
  ready: boolean;
  canWater?: boolean;
  watersLeftToday?: number;
  waterCooldownRemainingMs?: number;
  /** True while waiting for parent review or after a deny (greyed plant). */
  greyed?: boolean;
};

export type FarmPlayerCard = {
  id: string;
  name: string;
  mascot: Mascot;
  seeds: number;
  points: number;
  fertilizer: number;
  canWater: boolean;
  plots: PublicPlot[];
  hasPin: boolean;
  unlocked: boolean;
  isActive: boolean;
};
