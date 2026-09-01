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

export type PlotState = "empty" | "growing" | "mature";

export type PlantTier = {
  tier: number;
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
};

export type FarmPlayerCard = {
  id: string;
  name: string;
  mascot: Mascot;
  seeds: number;
  points: number;
  hasPin: boolean;
  unlocked: boolean;
  isActive: boolean;
};
