import { prisma } from "./db.js";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_GAME_CONFIG,
  getTier,
  mergeGameConfig,
  serializePlot,
  type GameConfig,
} from "@farmhand/shared";
import { todayKey } from "./tz.js";

export async function loadConfig(): Promise<GameConfig> {
  const row = await prisma.gameConfigRow.findUnique({ where: { id: "default" } });
  return mergeGameConfig(row?.data);
}

export async function saveConfig(config: GameConfig) {
  const merged = mergeGameConfig(config);
  await prisma.gameConfigRow.upsert({
    where: { id: "default" },
    update: { data: merged as Prisma.InputJsonValue },
    create: { id: "default", data: merged as Prisma.InputJsonValue },
  });
  return merged;
}

export function wateringState(
  player: {
    lastWateredAt: Date | null;
    wateringsOnDate: string | null;
    wateringsCount: number;
  },
  config: GameConfig,
  now = new Date(),
) {
  const today = todayKey(config.timezone, now);
  const count = player.wateringsOnDate === today ? player.wateringsCount : 0;
  const cooldownMs = config.wateringCooldownMinutes * 60 * 1000;
  const cooldownRemainingMs = player.lastWateredAt
    ? Math.max(0, player.lastWateredAt.getTime() + cooldownMs - now.getTime())
    : 0;
  return {
    today,
    wateringsUsed: count,
    wateringsLeft: Math.max(0, config.wateringMaxPerDay - count),
    cooldownRemainingMs,
    canWater: count < config.wateringMaxPerDay && cooldownRemainingMs === 0,
  };
}

export function publicPlayer(player: {
  id: string;
  name: string;
  mascot: string;
  seeds: number;
  points: number;
  fertilizer: number;
  moonDew: number;
  growGoo: number;
  phoenixAsh: number;
  lastIngredientClaimDate: string | null;
  nextIngredientIndex: number;
  lastWateredAt: Date | null;
  wateringsOnDate: string | null;
  wateringsCount: number;
  pinHash: string | null;
  isActive: boolean;
  plots: Array<{
    slot: number;
    plantTier: number | null;
    plantedAt: Date | null;
    waterReductionMinutes: number;
    fertilizerReductionMinutes: number;
  }>;
}, config: GameConfig, unlocked = true) {
  const water = wateringState(player, config);
  const today = todayKey(config.timezone);
  const nextIngredient = config.ingredients[player.nextIngredientIndex % config.ingredients.length];
  return {
    id: player.id,
    name: player.name,
    mascot: player.mascot,
    seeds: player.seeds,
    points: player.points,
    fertilizer: player.fertilizer,
    ingredients: {
      moonDew: player.moonDew,
      growGoo: player.growGoo,
      phoenixAsh: player.phoenixAsh,
    },
    claimedIngredientToday: player.lastIngredientClaimDate === today,
    nextIngredient,
    canMix: player.moonDew >= 1 && player.growGoo >= 1 && player.phoenixAsh >= 1,
    hasPin: Boolean(player.pinHash),
    isActive: player.isActive,
    unlocked,
    water,
    plots: player.plots
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((plot) => serializePlot(plot, config)),
  };
}

export function ensurePlots<T extends { slot: number }>(plots: T[], plotCount: number): T[] {
  return Array.from({ length: plotCount }, (_, slot) => {
    return plots.find((p) => p.slot === slot) ?? ({ slot } as T);
  });
}

export { getTier };
