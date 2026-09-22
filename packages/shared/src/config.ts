import { PLOTS_PER_GARDEN, type GameConfig } from "./types.js";

/** Parent-locked default. Admin can edit; reset-to-defaults restores this text. */
export const DEFAULT_BALANCE_GOALS =
  "Encourage short daily sessions with healthy watering use; avoid designs that reward only long waits or one OP crop.";

/** Aesthetic flatten: every crop costs 1 seed, grows 24h, and pays 25★. */
export const FLAT_TIER_SEED_COST = 1;
export const FLAT_TIER_DURATION_MINUTES = 24 * 60;
export const FLAT_TIER_POINTS = 25;

/**
 * Shipped v1 crop ladder (1/2/3 seeds, 24/48/72h, 1/2/4★). Boot-merge
 * replaces these exact triples with the flat table so existing compose DBs
 * are not stuck until someone hits Reset.
 */
const LEGACY_TIER_ECONOMY: Record<number, { seedCost: number; durationMinutes: number; points: number }> = {
  1: { seedCost: 1, durationMinutes: 24 * 60, points: 1 },
  2: { seedCost: 2, durationMinutes: 48 * 60, points: 2 },
  3: { seedCost: 3, durationMinutes: 72 * 60, points: 4 },
};

export function isLegacyTierEconomy(tier: {
  tier?: number;
  seedCost?: number;
  durationMinutes?: number;
  points?: number;
}): boolean {
  const legacy = LEGACY_TIER_ECONOMY[tier.tier ?? 0];
  if (!legacy) return false;
  return (
    tier.seedCost === legacy.seedCost &&
    tier.durationMinutes === legacy.durationMinutes &&
    tier.points === legacy.points
  );
}


/** True when every stored tier still has the old flat seedCost=1 lock. */
export function isFlatSeedCostTable(
  tiers: Array<{ seedCost?: number }> | undefined,
): boolean {
  if (!tiers?.length) return false;
  return tiers.every((tier) => Number(tier.seedCost) === FLAT_TIER_SEED_COST);
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  timezone: "America/Chicago",
  sessionMinutes: 30,
  startingSeeds: 10,
  startingPoints: 0,
  startingFertilizer: 0,
  wateringCooldownMinutes: 240,
  wateringMaxPerDay: 3,
  wateringReductionMinutes: 60,
  harvestSeedReturn: 1,
  plotCount: PLOTS_PER_GARDEN,
  mixYield: 1,
  jobBoardPosterDwellSeconds: 18,
  balanceGoals: DEFAULT_BALANCE_GOALS,
  ingredients: [
    { id: "moonDew", name: "Moon Dew", emoji: "🌙" },
    { id: "growGoo", name: "Grow Goo", emoji: "🟢" },
    { id: "phoenixAsh", name: "Phoenix Ash", emoji: "🔥" },
  ],
  /** 6-tier crop ladder with escalating seed cost, duration, and shard refund. */
  tiers: [
    {
      tier: 1,
      kind: "corn",
      emoji: "🌽",
      name: "Sweet Corn",
      seedCost: 1,
      durationMinutes: 24 * 60,
      points: 10,
      shardRefund: 1,
      fertilizerReductionMinutes: 4 * 60,
      stages: ["🌱", "🌿", "🌽", "🌽"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 2,
      kind: "cotton",
      emoji: "☁️",
      name: "Cotton",
      seedCost: 2,
      durationMinutes: 24 * 60,
      points: 20,
      shardRefund: 2,
      fertilizerReductionMinutes: 6 * 60,
      stages: ["🌱", "🌿", "🟢", "☁️"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 3,
      kind: "tomato",
      emoji: "🍅",
      name: "Heirloom Tomato",
      seedCost: 4,
      durationMinutes: 24 * 60,
      points: 40,
      shardRefund: 4,
      fertilizerReductionMinutes: 8 * 60,
      stages: ["🌱", "🌿", "🟢", "🍅"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 4,
      kind: "strawberry",
      emoji: "🍓",
      name: "Strawberry",
      seedCost: 6,
      durationMinutes: 24 * 60,
      points: 60,
      shardRefund: 6,
      fertilizerReductionMinutes: 10 * 60,
      stages: ["🌱", "🌿", "🌸", "🍓"],
      faces: ["��", "🙂", "😊", "😄"],
    },
    {
      tier: 5,
      kind: "pumpkin",
      emoji: "🎃",
      name: "Giant Pumpkin",
      seedCost: 8,
      durationMinutes: 24 * 60,
      points: 80,
      shardRefund: 8,
      fertilizerReductionMinutes: 12 * 60,
      stages: ["🌱", "🌿", "🎃", "🎃"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 6,
      kind: "sunflower",
      emoji: "🌻",
      name: "Sunflower",
      seedCost: 10,
      durationMinutes: 24 * 60,
      points: 100,
      shardRefund: 10,
      fertilizerReductionMinutes: 14 * 60,
      stages: ["🌱", "🌿", "🌻", "🌻"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
  ],
  /** How many shards = 1 full seed. Default 10. */
  shardsPerSeed: 10,
  /** Upper bound (inclusive) of each seed-reward band. */
  seedRewardBandUpperBounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  /** Seeds rewarded for a chore whose difficulty falls into each band. */
  seedRewardBandPayouts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
};

const LEGACY_TIER_NAMES = new Set(["Prairie Daisy", "Kitchen Herbs", "Sunflower", "Homestead Oak"]);

/** Wanted poster pinned time. Tear/pin stay short; this is the readable pause. */
export const JOB_BOARD_POSTER_DWELL_SECONDS_MIN = 5;
export const JOB_BOARD_POSTER_DWELL_SECONDS_MAX = 120;

export function clampJobBoardPosterDwell(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_GAME_CONFIG.jobBoardPosterDwellSeconds;
  return Math.min(
    JOB_BOARD_POSTER_DWELL_SECONDS_MAX,
    Math.max(JOB_BOARD_POSTER_DWELL_SECONDS_MIN, n),
  );
}

/** Clamp a numeric value to [min, max], floor to int. Returns fallback on NaN. */
function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

export function mergeGameConfig(raw: unknown): GameConfig {
  const incoming = raw && typeof raw === "object" ? (raw as Partial<GameConfig>) : {};
  const incomingTiers = Array.isArray(incoming.tiers) ? incoming.tiers : undefined;
  const legacy = incomingTiers?.some((t) => t?.name && LEGACY_TIER_NAMES.has(t.name));
  const flatSeeds = isFlatSeedCostTable(incomingTiers);
  const tiers = incomingTiers
    ? DEFAULT_GAME_CONFIG.tiers.map((tier) => {
        const match = incomingTiers.find((t) => t.tier === tier.tier);
        if (!match) return tier;
        if (legacy) {
          const flatten = isLegacyTierEconomy(match);
          return {
            ...tier,
            seedCost: flatten || flatSeeds ? tier.seedCost : (match.seedCost ?? tier.seedCost),
            durationMinutes: flatten ? tier.durationMinutes : (match.durationMinutes ?? tier.durationMinutes),
            points: flatten ? tier.points : (match.points ?? tier.points),
            fertilizerReductionMinutes: match.fertilizerReductionMinutes ?? tier.fertilizerReductionMinutes,
          };
        }
        if (isLegacyTierEconomy(match)) {
          return {
            ...tier,
            seedCost: tier.seedCost,
            durationMinutes: tier.durationMinutes,
            points: tier.points,
            fertilizerReductionMinutes: match.fertilizerReductionMinutes ?? tier.fertilizerReductionMinutes,
          };
        }
        const merged = {
          ...tier,
          ...match,
          kind: match.kind ?? tier.kind,
          stages: match.stages ?? tier.stages,
          faces: match.faces ?? tier.faces,
        };
        // Flat economy locked every crop to 1 seed; restore the tiered seed ladder
        // while keeping whatever durationMinutes the live DB currently has (e.g. TEST=1).
        if (flatSeeds) {
          merged.seedCost = tier.seedCost;
        }
        return merged;
      })
    : DEFAULT_GAME_CONFIG.tiers;

  const ingredients = Array.isArray(incoming.ingredients)
    ? DEFAULT_GAME_CONFIG.ingredients.map((ing) => {
        const match = incoming.ingredients?.find((i) => i.id === ing.id);
        return match ? { ...ing, ...match } : ing;
      })
    : DEFAULT_GAME_CONFIG.ingredients;

  // Clamp all numeric config knobs to sane ranges.
  // These guard against misconfiguration (negative costs, zero durations, etc.)
  // while preserving parent-authored custom values within bounds.
  return {
    ...DEFAULT_GAME_CONFIG,
    ...incoming,
    timezone: incoming.timezone || DEFAULT_GAME_CONFIG.timezone,
    sessionMinutes: clampInt(incoming.sessionMinutes, 5, 480, DEFAULT_GAME_CONFIG.sessionMinutes),
    startingSeeds: clampInt(incoming.startingSeeds, 0, 1000, DEFAULT_GAME_CONFIG.startingSeeds),
    startingPoints: clampInt(incoming.startingPoints, 0, 1_000_000, DEFAULT_GAME_CONFIG.startingPoints),
    startingFertilizer: clampInt(incoming.startingFertilizer, 0, 100, DEFAULT_GAME_CONFIG.startingFertilizer),
    wateringCooldownMinutes: clampInt(incoming.wateringCooldownMinutes, 1, 1440, DEFAULT_GAME_CONFIG.wateringCooldownMinutes),
    wateringMaxPerDay: clampInt(incoming.wateringMaxPerDay, 1, 50, DEFAULT_GAME_CONFIG.wateringMaxPerDay),
    wateringReductionMinutes: clampInt(incoming.wateringReductionMinutes, 1, 1440, DEFAULT_GAME_CONFIG.wateringReductionMinutes),
    harvestSeedReturn: clampInt(incoming.harvestSeedReturn, 0, 10, DEFAULT_GAME_CONFIG.harvestSeedReturn),
    plotCount: Math.max(PLOTS_PER_GARDEN, clampInt(incoming.plotCount, PLOTS_PER_GARDEN, 100, PLOTS_PER_GARDEN)),
    mixYield: clampInt(incoming.mixYield, 1, 100, DEFAULT_GAME_CONFIG.mixYield),
    jobBoardPosterDwellSeconds: clampJobBoardPosterDwell(
      incoming.jobBoardPosterDwellSeconds ?? DEFAULT_GAME_CONFIG.jobBoardPosterDwellSeconds,
    ),
    balanceGoals:
      typeof incoming.balanceGoals === "string" ? incoming.balanceGoals : DEFAULT_GAME_CONFIG.balanceGoals,
    tiers,
    ingredients,
    shardsPerSeed: clampInt(incoming.shardsPerSeed, 1, 100, DEFAULT_GAME_CONFIG.shardsPerSeed),
    seedRewardBandUpperBounds: validateBandArrays(incoming.seedRewardBandUpperBounds, incoming.seedRewardBandPayouts).bounds,
    seedRewardBandPayouts: validateBandArrays(incoming.seedRewardBandUpperBounds, incoming.seedRewardBandPayouts).payouts,
  };
}

function validateBandArrays(
  rawBounds: unknown,
  rawPayouts: unknown,
): { bounds: number[]; payouts: number[] } {
  const bounds = Array.isArray(rawBounds) ? rawBounds.filter((v): v is number => typeof v === "number" && v > 0) : [];
  const payouts = Array.isArray(rawPayouts) ? rawPayouts.filter((v): v is number => typeof v === "number" && v >= 0) : [];
  // Must be same length; if mismatched, trim to the shorter and ensure non-empty.
  const len = Math.min(bounds.length, payouts.length);
  if (len === 0) {
    return { bounds: DEFAULT_GAME_CONFIG.seedRewardBandUpperBounds, payouts: DEFAULT_GAME_CONFIG.seedRewardBandPayouts };
  }
  return { bounds: bounds.slice(0, len), payouts: payouts.slice(0, len) };
}
