import { PLOTS_PER_GARDEN, type GameConfig } from "./types.js";

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
      seedCost: 1,
      durationMinutes: 24 * 60,
      points: 1,
      fertilizerReductionMinutes: 4 * 60,
      stages: ["🌱", "🌿", "🌽", "🌽"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 2,
      kind: "strawberry",
      emoji: "🍓",
      name: "Strawberry",
      seedCost: 2,
      durationMinutes: 48 * 60,
      points: 2,
      fertilizerReductionMinutes: 6 * 60,
      stages: ["🌱", "🌿", "🌸", "🍓"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 3,
      kind: "cotton",
      emoji: "☁️",
      name: "Cotton",
      seedCost: 3,
      durationMinutes: 72 * 60,
      points: 4,
      fertilizerReductionMinutes: 8 * 60,
      stages: ["🌱", "🌿", "🟢", "☁️"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
  ],
};

const LEGACY_TIER_NAMES = new Set(["Prairie Daisy", "Kitchen Herbs", "Sunflower", "Homestead Oak"]);

export function mergeGameConfig(raw: unknown): GameConfig {
  const incoming = raw && typeof raw === "object" ? (raw as Partial<GameConfig>) : {};
  const incomingTiers = Array.isArray(incoming.tiers) ? incoming.tiers : undefined;
  const legacy = incomingTiers?.some((t) => t?.name && LEGACY_TIER_NAMES.has(t.name));
  const tiers = incomingTiers
    ? DEFAULT_GAME_CONFIG.tiers.map((tier) => {
        const match = incomingTiers.find((t) => t.tier === tier.tier);
        if (!match) return tier;
        if (legacy) {
          return {
            ...tier,
            seedCost: match.seedCost ?? tier.seedCost,
            durationMinutes: match.durationMinutes ?? tier.durationMinutes,
            points: match.points ?? tier.points,
            fertilizerReductionMinutes: match.fertilizerReductionMinutes ?? tier.fertilizerReductionMinutes,
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
    tiers,
    ingredients,
  };
}
