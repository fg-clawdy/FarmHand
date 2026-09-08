import { CROP_KINDS, cropKindForTier, type CropKind, type GameConfig } from "@farmhand/shared";
import { chicagoDayKeys, todayKey } from "./tz.js";

export type LogRow = {
  action: string;
  playerId: string | null;
  createdAt: Date;
  details: unknown;
};

export type CropMix = {
  counts: Record<CropKind, number>;
  total: number;
  pct: Record<CropKind, number>;
};

function emptyCounts(): Record<CropKind, number> {
  return { corn: 0, strawberry: 0, cotton: 0 };
}

function pctOf(counts: Record<CropKind, number>, total: number): Record<CropKind, number> {
  const pct = emptyCounts();
  for (const kind of CROP_KINDS) {
    pct[kind] = total ? Math.round((counts[kind] / total) * 1000) / 10 : 0;
  }
  return pct;
}

export function cropMixForAction(logs: readonly LogRow[], action: string): CropMix {
  const counts = emptyCounts();
  for (const log of logs) {
    if (log.action !== action) continue;
    const tier = (log.details as { tier?: number } | null)?.tier;
    if (tier == null) continue;
    counts[cropKindForTier(tier)] += 1;
  }
  const total = CROP_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
  return { counts, total, pct: pctOf(counts, total) };
}

export function cropMixFromPlots(plantTiers: readonly (number | null | undefined)[]): CropMix {
  const counts = emptyCounts();
  for (const tier of plantTiers) {
    if (tier == null) continue;
    counts[cropKindForTier(tier)] += 1;
  }
  const total = CROP_KINDS.reduce((sum, kind) => sum + counts[kind], 0);
  return { counts, total, pct: pctOf(counts, total) };
}

export type DayBucket = {
  day: string;
  harvests: number;
  waterings: number;
  logins: number;
  plants: number;
};

export function dailySeries(
  logs: readonly LogRow[],
  timezone: string,
  days: number,
  at = new Date(),
): DayBucket[] {
  const keys = chicagoDayKeys(timezone, days, at);
  const buckets = new Map(keys.map((day) => [day, { day, harvests: 0, waterings: 0, logins: 0, plants: 0 }]));
  for (const log of logs) {
    const bucket = buckets.get(todayKey(timezone, log.createdAt));
    if (!bucket) continue;
    if (log.action === "harvest") bucket.harvests += 1;
    else if (log.action === "watering") bucket.waterings += 1;
    else if (log.action === "login") bucket.logins += 1;
    else if (log.action === "plant") bucket.plants += 1;
  }
  return keys.map((day) => buckets.get(day)!);
}

export type Economy = {
  plants: number;
  harvests: number;
  waterings: number;
  logins: number;
  fertilizerUses: number;
  pointsAwarded: number;
  seedsSpent: number;
  seedsReturned: number;
  netSeeds: number;
};

export function economyFromLogs(logs: readonly LogRow[], config: GameConfig): Economy {
  const costByTier = new Map(config.tiers.map((tier) => [tier.tier, tier.seedCost]));
  const pointsByTier = new Map(config.tiers.map((tier) => [tier.tier, tier.points]));
  let plants = 0;
  let harvests = 0;
  let waterings = 0;
  let logins = 0;
  let fertilizerUses = 0;
  let pointsAwarded = 0;
  let seedsSpent = 0;
  let seedsReturned = 0;
  for (const log of logs) {
    const details = (log.details ?? {}) as { tier?: number; points?: number; seedsReturned?: number };
    if (log.action === "plant") {
      plants += 1;
      seedsSpent += costByTier.get(details.tier ?? 0) ?? 0;
    } else if (log.action === "harvest") {
      harvests += 1;
      pointsAwarded += details.points ?? pointsByTier.get(details.tier ?? 0) ?? 0;
      seedsReturned += details.seedsReturned ?? config.harvestSeedReturn;
    } else if (log.action === "watering") {
      waterings += 1;
    } else if (log.action === "login") {
      logins += 1;
    } else if (log.action === "fertilizer") {
      fertilizerUses += 1;
    }
  }
  return {
    plants,
    harvests,
    waterings,
    logins,
    fertilizerUses,
    pointsAwarded,
    seedsSpent,
    seedsReturned,
    netSeeds: seedsReturned - seedsSpent,
  };
}

export function playerComparison(
  players: readonly { id: string; name: string }[],
  logs: readonly LogRow[],
) {
  return players.map((player) => {
    const mine = logs.filter((log) => log.playerId === player.id);
    return {
      playerId: player.id,
      name: player.name,
      logins: mine.filter((log) => log.action === "login").length,
      waterings: mine.filter((log) => log.action === "watering").length,
      harvests: mine.filter((log) => log.action === "harvest").length,
      plants: mine.filter((log) => log.action === "plant").length,
    };
  });
}

export function balanceKnobs(config: GameConfig) {
  return {
    timezone: config.timezone,
    sessionMinutes: config.sessionMinutes,
    startingSeeds: config.startingSeeds,
    startingPoints: config.startingPoints,
    startingFertilizer: config.startingFertilizer,
    wateringCooldownMinutes: config.wateringCooldownMinutes,
    wateringMaxPerDay: config.wateringMaxPerDay,
    wateringReductionMinutes: config.wateringReductionMinutes,
    harvestSeedReturn: config.harvestSeedReturn,
    mixYield: config.mixYield,
    plotCount: config.plotCount,
    tiers: config.tiers.map((tier) => ({
      tier: tier.tier,
      kind: tier.kind,
      name: tier.name,
      seedCost: tier.seedCost,
      durationMinutes: tier.durationMinutes,
      points: tier.points,
      fertilizerReductionMinutes: tier.fertilizerReductionMinutes,
    })),
  };
}

export function windowStats(logs: readonly LogRow[], config: GameConfig) {
  return {
    cropMixPlanted: cropMixForAction(logs, "plant"),
    cropMixHarvested: cropMixForAction(logs, "harvest"),
    economy: economyFromLogs(logs, config),
  };
}
