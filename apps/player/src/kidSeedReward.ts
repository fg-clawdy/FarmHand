import { formatSeedRewardChip } from "@farmhand/shared";

/** Kid-facing seed reward label from API resolveSeedReward count. */
export function kidSeedRewardLabel(
  count: number | null | undefined,
  kind: "seed" | "super_seed" = "seed",
): string {
  return formatSeedRewardChip(count, kind);
}

export function kidSeedRewardCount(count: number | null | undefined): number {
  const n = Math.round(Number(count));
  return Number.isFinite(n) && n > 0 ? n : 1;
}
