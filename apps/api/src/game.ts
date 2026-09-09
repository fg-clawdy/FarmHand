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

function storedEconomyNeedsWrite(stored: Record<string, unknown>, merged: GameConfig): boolean {
  const storedTiers = Array.isArray(stored.tiers) ? (stored.tiers as Array<Record<string, unknown>>) : [];
  return merged.tiers.some((tier) => {
    const row = storedTiers.find((candidate) => candidate.tier === tier.tier);
    if (!row) return true;
    return (
      Number(row.seedCost) !== tier.seedCost ||
      Number(row.durationMinutes) !== tier.durationMinutes ||
      Number(row.points) !== tier.points
    );
  });
}

export async function loadConfig(): Promise<GameConfig> {
  const row = await prisma.gameConfigRow.findUnique({ where: { id: "default" } });
  const merged = mergeGameConfig(row?.data);
  const stored = row?.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : {};
  const needsPlot = Number(stored.plotCount) !== merged.plotCount;
  const needsGoals = typeof stored.balanceGoals !== "string";
  const needsEconomy = storedEconomyNeedsWrite(stored, merged);
  if (needsPlot || needsGoals || needsEconomy) {
    return saveConfig(merged);
  }
  return merged;
}

export async function saveConfig(config: GameConfig) {
  const merged = mergeGameConfig(config);
  await prisma.gameConfigRow.upsert({
    where: { id: "default" },
    update: { data: merged as Prisma.InputJsonValue },
    create: { id: "default", data: merged as Prisma.InputJsonValue },
  });
  await syncAllPlayerPlots(merged.plotCount);
  return merged;
}

export function selfieUnlockedOn(unlockDate: string | null | undefined, timezone: string, now = new Date()) {
  return unlockDate === todayKey(timezone, now);
}

/** Per-plant 4h / 3-per-Chicago-day caps (values come from tunables). */
export function plotWateringState(
  plot: {
    lastWateredAt?: Date | null;
    wateringsOnDate?: string | null;
    wateringsCount?: number;
  },
  config: GameConfig,
  now = new Date(),
) {
  const today = todayKey(config.timezone, now);
  const used = plot.wateringsOnDate === today ? (plot.wateringsCount ?? 0) : 0;
  const cooldownMs = config.wateringCooldownMinutes * 60 * 1000;
  const cooldownRemainingMs = plot.lastWateredAt
    ? Math.max(0, plot.lastWateredAt.getTime() + cooldownMs - now.getTime())
    : 0;
  const wateringsLeft = Math.max(0, config.wateringMaxPerDay - used);
  return {
    today,
    wateringsUsed: used,
    wateringsLeft,
    cooldownRemainingMs,
    canWater: wateringsLeft > 0 && cooldownRemainingMs === 0,
  };
}

/** Garden summary: selfie unlock + whether any growing plot can take water. */
export function wateringState(
  player: {
    selfieUnlockDate?: string | null;
    selfieSeedGrantDate?: string | null;
    lastWateredAt?: Date | null;
    wateringsOnDate?: string | null;
    wateringsCount?: number;
    plots?: Array<{
      plantTier?: number | null;
      plantedAt?: Date | null;
      lastWateredAt?: Date | null;
      wateringsOnDate?: string | null;
      wateringsCount?: number;
      waterReductionMinutes?: number;
      fertilizerReductionMinutes?: number;
      slot?: number;
    }>;
  },
  config: GameConfig,
  now = new Date(),
) {
  const today = todayKey(config.timezone, now);
  const unlocked = selfieUnlockedOn(player.selfieUnlockDate, config.timezone, now);
  const plots = player.plots ?? [];
  let wateringsUsed = 0;
  let wateringsLeft = 0;
  let cooldownRemainingMs = 0;
  let anyCan = false;
  for (const plot of plots) {
    if (!plot.plantedAt || !plot.plantTier) continue;
    const serialized = serializePlot(
      {
        slot: plot.slot ?? 0,
        plantTier: plot.plantTier,
        plantedAt: plot.plantedAt,
        waterReductionMinutes: plot.waterReductionMinutes ?? 0,
        fertilizerReductionMinutes: plot.fertilizerReductionMinutes ?? 0,
      },
      config,
      now,
    );
    if (serialized.ready) continue;
    const pw = plotWateringState(plot, config, now);
    wateringsUsed += pw.wateringsUsed;
    wateringsLeft = Math.max(wateringsLeft, pw.wateringsLeft);
    if (anyCan) {
      cooldownRemainingMs = Math.min(cooldownRemainingMs, pw.cooldownRemainingMs);
    } else {
      cooldownRemainingMs = pw.cooldownRemainingMs;
    }
    if (pw.canWater) anyCan = true;
  }
  if (!plots.length) {
    const legacyUsed = player.wateringsOnDate === today ? (player.wateringsCount ?? 0) : 0;
    const cooldownMs = config.wateringCooldownMinutes * 60 * 1000;
    cooldownRemainingMs = player.lastWateredAt
      ? Math.max(0, player.lastWateredAt.getTime() + cooldownMs - now.getTime())
      : 0;
    wateringsUsed = legacyUsed;
    wateringsLeft = Math.max(0, config.wateringMaxPerDay - legacyUsed);
    anyCan = wateringsLeft > 0 && cooldownRemainingMs === 0;
  }
  return {
    today,
    unlocked,
    seedGrantedToday: player.selfieSeedGrantDate === today,
    wateringsUsed,
    wateringsLeft: unlocked ? wateringsLeft : 0,
    cooldownRemainingMs: unlocked ? cooldownRemainingMs : 0,
    canWater: unlocked && anyCan,
  };
}

export async function syncPlayerPlots(playerId: string, plotCount: number) {
  const existing = await prisma.plot.findMany({ where: { playerId }, select: { slot: true } });
  const have = new Set(existing.map((plot) => plot.slot));
  const missing = Array.from({ length: plotCount }, (_, slot) => slot)
    .filter((slot) => !have.has(slot))
    .map((slot) => ({ playerId, slot }));
  if (missing.length === 0) return;
  await prisma.plot.createMany({ data: missing, skipDuplicates: true });
}

export async function syncAllPlayerPlots(plotCount: number) {
  const players = await prisma.player.findMany({ select: { id: true } });
  for (const player of players) {
    await syncPlayerPlots(player.id, plotCount);
  }
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
  selfieUnlockDate?: string | null;
  selfieSeedGrantDate?: string | null;
  pinHash: string | null;
  isActive: boolean;
  plots: Array<{
    slot: number;
    plantTier: number | null;
    plantedAt: Date | null;
    waterReductionMinutes: number;
    fertilizerReductionMinutes: number;
    lastWateredAt?: Date | null;
    wateringsOnDate?: string | null;
    wateringsCount?: number;
  }>;
}, config: GameConfig, unlocked = true, now = new Date()) {
  const water = wateringState(player, config, now);
  const today = todayKey(config.timezone, now);
  const nextIngredient = config.ingredients[player.nextIngredientIndex % config.ingredients.length];
  const selfieOn = selfieUnlockedOn(player.selfieUnlockDate, config.timezone, now);
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
    selfie: {
      today,
      unlocked: selfieOn,
      seedGrantedToday: player.selfieSeedGrantDate === today,
    },
    water,
    plots: ensurePlots(player.plots, config.plotCount).map((plot) => {
      const serialized = serializePlot(plot, config, now);
      const pw = plotWateringState(plot, config, now);
      const canWater = selfieOn && serialized.state === "growing" && !serialized.ready && pw.canWater;
      return {
        ...serialized,
        canWater,
        watersLeftToday: selfieOn ? pw.wateringsLeft : 0,
        waterCooldownRemainingMs: selfieOn ? pw.cooldownRemainingMs : 0,
      };
    }),
  };
}

export function ensurePlots<T extends { slot: number }>(plots: T[], plotCount: number): T[] {
  return Array.from({ length: plotCount }, (_, slot) => {
    return plots.find((p) => p.slot === slot) ?? ({ slot } as T);
  });
}

export { getTier };
