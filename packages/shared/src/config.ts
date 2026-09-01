import type { GameConfig } from "./types.js";

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
  plotCount: 6,
  mixYield: 1,
  ingredients: [
    { id: "moonDew", name: "Moon Dew", emoji: "🌙" },
    { id: "growGoo", name: "Grow Goo", emoji: "🟢" },
    { id: "phoenixAsh", name: "Phoenix Ash", emoji: "🔥" },
  ],
  tiers: [
    {
      tier: 1,
      emoji: "🌼",
      name: "Prairie Daisy",
      seedCost: 1,
      durationMinutes: 24 * 60,
      points: 1,
      fertilizerReductionMinutes: 4 * 60,
      stages: ["🌱", "🌿", "🌸", "🌼"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 2,
      emoji: "🌿",
      name: "Kitchen Herbs",
      seedCost: 2,
      durationMinutes: 48 * 60,
      points: 2,
      fertilizerReductionMinutes: 6 * 60,
      stages: ["🌱", "🍀", "🥬", "🌿"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 3,
      emoji: "🌻",
      name: "Sunflower",
      seedCost: 3,
      durationMinutes: 72 * 60,
      points: 4,
      fertilizerReductionMinutes: 8 * 60,
      stages: ["🌱", "🌾", "🌼", "🌻"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
    {
      tier: 4,
      emoji: "🌳",
      name: "Homestead Oak",
      seedCost: 4,
      durationMinutes: 96 * 60,
      points: 8,
      fertilizerReductionMinutes: 10 * 60,
      stages: ["🌱", "🌿", "🌲", "🌳"],
      faces: ["😌", "🙂", "😊", "😄"],
    },
  ],
};

export function mergeGameConfig(raw: unknown): GameConfig {
  const incoming = raw && typeof raw === "object" ? (raw as Partial<GameConfig>) : {};
  const tiers = Array.isArray(incoming.tiers)
    ? DEFAULT_GAME_CONFIG.tiers.map((tier) => {
        const match = incoming.tiers?.find((t) => t.tier === tier.tier);
        return match ? { ...tier, ...match, stages: match.stages ?? tier.stages, faces: match.faces ?? tier.faces } : tier;
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
    tiers,
    ingredients,
  };
}
