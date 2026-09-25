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

export const CROP_KINDS = ["corn", "cotton", "tomato", "strawberry", "pumpkin", "sunflower"] as const;
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
  /** Shards returned at harvest (before shard-to-seed conversion). */
  shardRefund: number;
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
  /**
   * Seconds a Wanted poster stays pinned on the Job Board before the tear.
   * Admin-tunable; tear/pin animations stay short.
   */
  jobBoardPosterDwellSeconds: number;
  /** Parent-authored “what good play looks like” for AI balance review. */
  balanceGoals: string;
  ingredients: IngredientDef[];
  tiers: PlantTier[];
  /** How many shards = 1 full seed. Default 10. */
  shardsPerSeed: number;
  /** Upper bound (inclusive) of each seed-reward band. Length = number of bands. */
  seedRewardBandUpperBounds: number[];
  /** Seeds rewarded for a chore whose difficulty falls into each band. */
  seedRewardBandPayouts: number[];
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
  /** True after a deny (greyed plant). Pending approval uses awaitingApproval + purple aura instead. */
  greyed?: boolean;
  /** True while any provisional seed on this plant still needs parent approval. */
  awaitingApproval?: boolean;
  /** Pending chore claims whose provisional seeds funded this plant. */
  pendingChores?: Array<{
    claimId: string;
    title: string;
    emoji: string;
    claimedAt: string;
    seedsUsed: number;
  }>;
  /** Crop seed cost from economy config. */
  seedCost?: number | null;
  /** Stars/points awarded when harvested/sold. */
  harvestPoints?: number | null;
  /** Crop display name. */
  cropName?: string | null;
  /** Last watered timestamp when known. */
  lastWateredAt?: string | null;
};

export type FarmPlayerCard = {
  id: string;
  name: string;
  mascot: Mascot;
  avatarKind?: string;
  avatarPreset?: string | null;
  avatarUrl?: string | null;
  seeds: number;
  provisionalSeeds: number;
  /** Kid→parent approvals nudge rate-limit status. */
  notifyParent?: { allowed: boolean; retryAt: string | null; retryInMs: number };
  points: number;
  fertilizer: number;
  canWater: boolean;
  plots: PublicPlot[];
  hasPin: boolean;
  unlocked: boolean;
  isActive: boolean;
  seedShards: number;
};
