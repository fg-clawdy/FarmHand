import { prisma } from "./db.js";
import type { Prisma } from "@prisma/client";
import {
  DEFAULT_GAME_CONFIG,
  getTier,
  mergeGameConfig,
  parentNotifyGate,
  serializePlot,
  type GameConfig,
} from "@farmhand/shared";
import { todayKey } from "./tz.js";
import { avatarFieldsPublic } from "./avatar.js";

function sameNumberArray(a: unknown, b: readonly number[]): boolean {
  if (!Array.isArray(a) || a.length !== b.length) return false;
  return a.every((v, i) => Number(v) === b[i]);
}

/** Old mistaken default mapped difficulty 1:1 to seeds (shoes/diff 2 → 2). PRD bands are [2,4,6,8,10]→[1,2,3,4,5]. */
function storedBandsNeedRewrite(stored: Record<string, unknown>): boolean {
  const badBounds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const badPayouts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    sameNumberArray(stored.seedRewardBandUpperBounds, badBounds) &&
    sameNumberArray(stored.seedRewardBandPayouts, badPayouts)
  );
}

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
  const needsBands = storedBandsNeedRewrite(stored);
  const next = needsBands
    ? {
        ...merged,
        seedRewardBandUpperBounds: DEFAULT_GAME_CONFIG.seedRewardBandUpperBounds,
        seedRewardBandPayouts: DEFAULT_GAME_CONFIG.seedRewardBandPayouts,
      }
    : merged;
  if (needsPlot || needsGoals || needsEconomy || needsBands) {
    return saveConfig(next);
  }
  return next;
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
      phase?: string | null;
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
        phase: plot.phase,
        waterReductionMinutes: plot.waterReductionMinutes ?? 0,
        fertilizerReductionMinutes: plot.fertilizerReductionMinutes ?? 0,
      },
      config,
      now,
    );
    if (serialized.state !== "growing" || serialized.ready) continue;
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


export type PublicBasketItem = {
  id: string;
  kind: string;
  name: string;
  emoji: string;
  points: number;
};

export type PublicBasket = {
  items: PublicBasketItem[];
  totalPoints: number;
};

/** Held produce only. Missing relation (older callers) is an empty basket, not a crash. */
export function publicBasket(items: Array<{
  id: string;
  cropKind: string;
  name: string;
  emoji: string;
  points: number;
  createdAt?: Date;
}>): PublicBasket {
  const sorted = [...items].sort((a, b) => {
    const at = a.createdAt?.getTime() ?? 0;
    const bt = b.createdAt?.getTime() ?? 0;
    return at - bt;
  });
  const publicItems = sorted.map((item) => ({
    id: item.id,
    kind: item.cropKind,
    name: item.name,
    emoji: item.emoji,
    points: item.points,
  }));
  return {
    items: publicItems,
    totalPoints: publicItems.reduce((sum, item) => sum + item.points, 0),
  };
}

export function publicPlayer(player: {
  id: string;
  name: string;
  mascot: string;
  avatarKind?: string | null;
  avatarPreset?: string | null;
  avatarSelfieFile?: string | null;
  seeds: number;
  provisionalSeeds: number;
  points: number;
  fertilizer: number;
  seedShards: number;
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
  lastParentNotifyAt?: Date | null;
  plots: Array<{
    slot: number;
    plantTier: number | null;
    plantedAt: Date | null;
    phase?: string | null;
    waterReductionMinutes: number;
    fertilizerReductionMinutes: number;
    lastWateredAt?: Date | null;
    wateringsOnDate?: string | null;
    wateringsCount?: number;
    claimLinks?: Array<{
      seedsUsed: number;
      claim: {
        id: string;
        status: string;
        claimedAt: Date;
        chore: { title: string; emoji: string };
      };
    }>;
  }>;
  basketItems?: Array<{
    id: string;
    cropKind: string;
    name: string;
    emoji: string;
    points: number;
    createdAt: Date;
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
    ...avatarFieldsPublic(player),
    seeds: player.seeds,
    provisionalSeeds: player.provisionalSeeds,
    points: player.points,
    fertilizer: player.fertilizer,
    seedShards: player.seedShards,
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
    basket: publicBasket(player.basketItems ?? []),
    notifyParent: parentNotifyGate(player.lastParentNotifyAt ?? null, now),
    plots: ensurePlots(player.plots, config.plotCount).map((plot) => {
      const serialized = serializePlot(plot, config, now);
      const pw = plotWateringState(plot, config, now);
      // Pending-approval plants grow and may be watered; wilted/mature still blocked by existing rules.
      const canWater =
        selfieOn &&
        (serialized.state === "growing" || serialized.state === "purgatory") &&
        !serialized.ready &&
        pw.canWater &&
        serialized.state !== "wilted";
      const pendingChores = (plot.claimLinks ?? [])
        .filter((link) => link.claim.status === "PENDING")
        .map((link) => ({
          claimId: link.claim.id,
          title: link.claim.chore.title,
          emoji: link.claim.chore.emoji,
          claimedAt: link.claim.claimedAt.toISOString(),
          seedsUsed: link.seedsUsed,
        }));
      const awaitingApproval = pendingChores.length > 0;
      const tier = plot.plantTier ? getTier(config, plot.plantTier) : null;
      return {
        ...serialized,
        // Grey only wilted plants; pending uses purple aura via awaitingApproval.
        greyed: serialized.state === "wilted",
        canWater,
        watersLeftToday: selfieOn ? pw.wateringsLeft : 0,
        waterCooldownRemainingMs: selfieOn ? pw.cooldownRemainingMs : 0,
        awaitingApproval,
        pendingChores,
        seedCost: tier?.seedCost ?? null,
        harvestPoints: tier?.points ?? null,
        cropName: tier?.name ?? null,
        lastWateredAt: plot.lastWateredAt ? plot.lastWateredAt.toISOString() : null,
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
