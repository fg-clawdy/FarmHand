import type { GameConfig, PlantTier, PlotPhase, PublicPlot } from "./types.js";

export type PlotInput = {
  slot: number;
  plantTier: number | null;
  plantedAt: Date | string | null;
  waterReductionMinutes: number;
  fertilizerReductionMinutes: number;
  phase?: PlotPhase | string | null;
};

export function plotIsEmpty(plot: Pick<PlotInput, "plantTier">): boolean {
  return !plot.plantTier;
}

function emptyPublicPlot(slot: number): PublicPlot {
  return {
    slot,
    state: "empty",
    tier: null,
    plantedAt: null,
    maturesAt: null,
    remainingMs: 0,
    growthStage: null,
    emoji: null,
    face: null,
    ready: false,
    canWater: false,
    watersLeftToday: 0,
    waterCooldownRemainingMs: 0,
    greyed: false,
  };
}

function stagedSprout(plot: PlotInput, config: GameConfig, state: "purgatory" | "wilted"): PublicPlot {
  const tier = getTier(config, plot.plantTier ?? 1);
  return {
    slot: plot.slot,
    state,
    tier: plot.plantTier,
    plantedAt: null,
    maturesAt: null,
    remainingMs: 0,
    growthStage: 1,
    emoji: tier.stages[0],
    face: tier.faces[0],
    ready: false,
    canWater: false,
    watersLeftToday: 0,
    waterCooldownRemainingMs: 0,
    greyed: true,
  };
}

export function getTier(config: GameConfig, tier: number): PlantTier {
  const found = config.tiers.find((t) => t.tier === tier);
  if (found) return found;
  const last = config.tiers[config.tiers.length - 1];
  if (last) return last;
  throw new Error(`Unknown plant tier ${tier}`);
}

export function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function maturityDate(plot: PlotInput, tier: PlantTier): Date | null {
  const plantedAt = asDate(plot.plantedAt);
  if (!plantedAt) return null;
  const baseMs = tier.durationMinutes * 60 * 1000;
  const reductionMs =
    (plot.waterReductionMinutes + plot.fertilizerReductionMinutes) * 60 * 1000;
  return new Date(plantedAt.getTime() + baseMs - reductionMs);
}

export function remainingMs(maturesAt: Date | null, now = new Date()): number {
  if (!maturesAt) return 0;
  return Math.max(0, maturesAt.getTime() - now.getTime());
}

export function growthStage(
  plantedAt: Date,
  maturesAt: Date,
  now = new Date(),
): 1 | 2 | 3 | 4 {
  const total = maturesAt.getTime() - plantedAt.getTime();
  if (total <= 0) return 4;
  const elapsed = now.getTime() - plantedAt.getTime();
  const pct = elapsed / total;
  if (pct >= 1) return 4;
  if (pct >= 0.75) return 4;
  if (pct >= 0.5) return 3;
  if (pct >= 0.25) return 2;
  return 1;
}

export function serializePlot(plot: PlotInput, config: GameConfig, now = new Date()): PublicPlot {
  if (!plot.plantTier) return emptyPublicPlot(plot.slot);
  if (plot.phase === "wilted") return stagedSprout(plot, config, "wilted");
  if (plot.phase === "purgatory" || !plot.plantedAt) return stagedSprout(plot, config, "purgatory");

  const plantedAt = asDate(plot.plantedAt)!;
  const tier = getTier(config, plot.plantTier);
  const maturesAt = maturityDate(plot, tier)!;
  const left = remainingMs(maturesAt, now);
  const ready = left === 0;
  const stage = growthStage(plantedAt, maturesAt, now);
  const index = stage - 1;

  return {
    slot: plot.slot,
    state: ready ? "mature" : "growing",
    tier: plot.plantTier,
    plantedAt: plantedAt.toISOString(),
    maturesAt: maturesAt.toISOString(),
    remainingMs: left,
    growthStage: stage,
    emoji: tier.stages[index],
    face: tier.faces[index],
    ready,
    canWater: false,
    watersLeftToday: 0,
    waterCooldownRemainingMs: 0,
    greyed: false,
  };
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "READY";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return `${days}d ${remH}h`;
  }
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${minutes}m`;
}
