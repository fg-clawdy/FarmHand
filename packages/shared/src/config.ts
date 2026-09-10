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
  tiers: [
    {
      tier: 1,
      kind: "corn",
      emoji: "🌽",
      name: "Sweet Corn",
      seedCost: FLAT_TIER_SEED_COST,
      durationMinutes: FLAT_TIER_DURATION_MINUTES,
      points: FLAT_TIER_POINTS,
      fertilizerReductionMinutes: 4 * 60,
      stages: ["🌱", "🌿", "🌽", "🌽"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 2,
      kind: "strawberry",
      emoji: "🍓",
      name: "Strawberry",
      seedCost: FLAT_TIER_SEED_COST,
      durationMinutes: FLAT_TIER_DURATION_MINUTES,
      points: FLAT_TIER_POINTS,
      fertilizerReductionMinutes: 6 * 60,
      stages: ["🌱", "🌿", "🌸", "🍓"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 3,
      kind: "cotton",
      emoji: "☁️",
      name: "Cotton",
      seedCost: FLAT_TIER_SEED_COST,
      durationMinutes: FLAT_TIER_DURATION_MINUTES,
      points: FLAT_TIER_POINTS,
      fertilizerReductionMinutes: 8 * 60,
      stages: ["🌱", "🌿", "🟢", "☁️"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
  ],
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

export function mergeGameConfig(raw: unknown): GameConfig {
  const incoming = raw && typeof raw === "object" ? (raw as Partial<GameConfig>) : {};
  const incomingTiers = Array.isArray(incoming.tiers) ? incoming.tiers : undefined;
  const legacy = incomingTiers?.some((t) => t?.name && LEGACY_TIER_NAMES.has(t.name));
  const tiers = incomingTiers
    ? DEFAULT_GAME_CONFIG.tiers.map((tier) => {
        const match = incomingTiers.find((t) => t.tier === tier.tier);
        if (!match) return tier;
        if (legacy) {
          const flatten = isLegacyTierEconomy(match);
          return {
            ...tier,
            seedCost: flatten ? tier.seedCost : (match.seedCost ?? tier.seedCost),
            durationMinutes: flatten ? tier.durationMinutes : (match.durationMinutes ?? tier.durationMinutes),
            points: flatten ? tier.points : (match.points ?? tier.points),
            fertilizerReductionMinutes: match.fertilizerReductionMinutes ?? tier.fertilizerReductionMinutes,
          };
        }
        if (isLegacyTierEconomy(match)) {
          return {
            ...tier,
            ...match,
            kind: match.kind ?? tier.kind,
            stages: match.stages ?? tier.stages,
            faces: match.faces ?? tier.faces,
            seedCost: tier.seedCost,
            durationMinutes: tier.durationMinutes,
            points: tier.points,
          };
        }
        return { ...tier, ...match, kind: match.kind ?? tier.kind, stages: match.stages ?? tier.stages, faces: match.faces ?? tier.faces };
      })
    : DEFAULT_GAME_CONFIG.tiers;

  const ingredients = Array.isArray(incoming.ingredients)
    ? DEFAULT_GAME_CONFIG.ingredients.map((ing) => {
        const match = incoming.ingredients?.find((i) => i.id === ing.id);
        return match ? { ...ing, ...match } : ing;
      })
    : DEFAULT_GAME_CONFIG.ingredients;

  return {
    ...DEFAULT_GAME_CONFIG,
    ...incoming,
    timezone: incoming.timezone || DEFAULT_GAME_CONFIG.timezone,
    plotCount: Math.max(PLOTS_PER_GARDEN, Number(incoming.plotCount) || 0),
    jobBoardPosterDwellSeconds: clampJobBoardPosterDwell(
      incoming.jobBoardPosterDwellSeconds ?? DEFAULT_GAME_CONFIG.jobBoardPosterDwellSeconds,
    ),
    balanceGoals:
      typeof incoming.balanceGoals === "string" ? incoming.balanceGoals : DEFAULT_GAME_CONFIG.balanceGoals,
    tiers,
    ingredients,
  };
}
