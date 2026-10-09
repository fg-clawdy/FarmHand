export const MASCOTS = ["cow", "chicken", "pig", "sheep", "horse"] as const;
export type Mascot = (typeof MASCOTS)[number];

export const MASCOT_EMOJI: Record<Mascot, string> = {
  cow: "🐄",
  chicken: "🐔",
  pig: "🐷",
  sheep: "🐑",
  horse: "🐴",
};

export const KID_COLORS = [
  { id: "coral", label: "Coral", hex: "#f2857f", soft: "#fdeae8", ink: "#8a2f2a" },
  { id: "sunny", label: "Sunny", hex: "#f6c344", soft: "#fff4d6", ink: "#7a5a12" },
  { id: "grass", label: "Grass", hex: "#7ec24a", soft: "#ecf6da", ink: "#3c5a14" },
  { id: "sky", label: "Sky", hex: "#59a8e8", soft: "#e2f1fc", ink: "#1f5a80" },
  { id: "grape", label: "Grape", hex: "#a575d8", soft: "#f1e7fb", ink: "#5a2a80" },
  { id: "berry", label: "Berry", hex: "#ef7aa6", soft: "#fde3ee", ink: "#8a1f52" },
  { id: "tangerine", label: "Tangerine", hex: "#f7973f", soft: "#fdebd6", ink: "#8a4a12" },
  { id: "mint", label: "Mint", hex: "#4fc7b0", soft: "#e0f5ef", ink: "#1a5f50" },
] as const;
export type KidColorId = (typeof KID_COLORS)[number]["id"];
export const DEFAULT_KID_COLOR: KidColorId = "coral";
/** Resolve a stored color id (or a null/missing one) to a palette entry. */
export function kidColor(id: string | null | undefined) {
  return KID_COLORS.find((c) => c.id === id) ?? KID_COLORS[0];
}

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
  /** Points awarded when harvested/sold. */
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
  /** Kid-picked accent color id (see KID_COLORS). Null until the kid picks one. */
  color?: string | null;
};
