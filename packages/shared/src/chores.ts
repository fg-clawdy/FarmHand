import type { ChoreAssignmentMode, ChoreRecurrence } from "./choreCatalog.js";
import type { GameConfig } from "./types.js";

export type ClaimGate = {
  ok: boolean;
  reason?: string;
};

/** Why a kid may or may not claim this chore for the current period. */
export function choreClaimGate(opts: {
  isActive: boolean;
  periodEligible: boolean;
  assignmentMode: ChoreAssignmentMode;
  hasAssignment: boolean;
  alreadyClaimedByPlayer: boolean;
  raceTaken: boolean;
}): ClaimGate {
  if (!opts.isActive) return { ok: false, reason: "That chore is turned off." };
  if (!opts.periodEligible) return { ok: false, reason: "Not today for that chore." };
  if (opts.assignmentMode === "SPECIFIC" && !opts.hasAssignment) {
    return { ok: false, reason: "That chore isn't assigned to you." };
  }
  if (opts.alreadyClaimedByPlayer) {
    return { ok: false, reason: "You already claimed that chore." };
  }
  if (opts.assignmentMode === "RACE" && opts.raceTaken) {
    return { ok: false, reason: "Someone already claimed that chore." };
  }
  return { ok: true };
}

/** True when at least one active kid could still claim this chore this period. */
export function choreOpenForFamily(opts: {
  isActive: boolean;
  periodEligible: boolean;
  assignmentMode: ChoreAssignmentMode;
  assignedPlayerIds: readonly string[];
  activePlayerIds: readonly string[];
  claimedPlayerIdsThisPeriod: readonly string[];
  raceTaken: boolean;
}): boolean {
  if (!opts.isActive || !opts.periodEligible) return false;
  if (opts.assignmentMode === "RACE" && opts.raceTaken) return false;
  const claimed = new Set(opts.claimedPlayerIdsThisPeriod);
  const candidates =
    opts.assignmentMode === "SPECIFIC"
      ? opts.activePlayerIds.filter((id) => opts.assignedPlayerIds.includes(id))
      : opts.activePlayerIds;
  if (candidates.length === 0) return false;
  return candidates.some((id) => !claimed.has(id));
}

export function closedPeriodKey(status: "DENIED" | "DONE", claimId: string): string {
  return `${status.toLowerCase()}:${claimId}`;
}

/** NONE chores reuse periodKey "open" until the claim is finished (deny or harvest). */
export function recurrenceFreesOnHarvest(recurrence: ChoreRecurrence): boolean {
  return recurrence === "NONE";
}

/** Resolve the seed reward for a chore claim using the band system.
 *
 * Priority:
 * 1. Per-chore `seedReward` override (if non-null).
 * 2. If `difficulty` is null, fall back to legacy 1 seed.
 * 3. Walk the `seedRewardBandUpperBounds` array; the first band whose upper
 *    bound is >= difficulty determines the payout.
 * 4. If difficulty exceeds all bands, use the last band's payout.
 */
export function resolveSeedReward(
  chore: { seedReward?: number | null; difficulty?: number | null },
  config: GameConfig,
): number {
  if (chore.seedReward != null) return chore.seedReward;
  if (chore.difficulty == null) return 1;
  const d = chore.difficulty;
  for (let i = 0; i < config.seedRewardBandUpperBounds.length; i++) {
    if (d <= config.seedRewardBandUpperBounds[i]) {
      return config.seedRewardBandPayouts[i];
    }
  }
  return config.seedRewardBandPayouts[config.seedRewardBandPayouts.length - 1];
}

export type JobBoardRewardKind = "seed" | "super_seed";

/**
 * Fallback only. Real payouts come from resolveSeedReward (difficulty bands
 * or a per-chore seedReward). Do not treat this as "every chore pays 1".
 */
export const JOB_BOARD_V1_REWARD_SEED_COUNT = 1;

export type JobBoardRewardFields = {
  rewardSeedCount?: number;
  rewardSeedKind?: JobBoardRewardKind;
  rewardLabel?: string;
};

/** Short kid-facing chip: "+1 seed" / "+2 seeds". */
export function formatSeedRewardChip(
  count: number | null | undefined,
  kind: JobBoardRewardKind = "seed",
): string {
  const n = Math.max(0, Math.round(Number(count) || 0));
  const unit = kind === "super_seed" ? "super seed" : "seed";
  if (n <= 1) return `+1 ${unit}`;
  return `+${n} ${unit}s`;
}

/** Baked Wanted-poster ink: "+1 SEED" / "+2 SEEDS". */
export function formatWantedSeedLabel(
  count: number | null | undefined,
  kind: JobBoardRewardKind = "seed",
): string {
  const n = Math.max(1, Math.round(Number(count) || 0) || JOB_BOARD_V1_REWARD_SEED_COUNT);
  const unit = kind === "super_seed" ? "SUPER SEED" : "SEED";
  return n === 1 ? `+1 ${unit}` : `+${n} ${unit}S`;
}

/** Farm poster / empty-board copy. Title stays off the flyer. */
export function formatJobBoardReward(job: JobBoardRewardFields | null | undefined): string {
  if (!job) return "Check back soon";
  const label = job.rewardLabel?.trim();
  if (label) return label;
  const raw = Number(job.rewardSeedCount);
  const count = Number.isFinite(raw) && raw > 0 ? Math.round(raw) : JOB_BOARD_V1_REWARD_SEED_COUNT;
  if (job.rewardSeedKind === "super_seed") {
    return count === 1 ? "Reward: 1 super seed" : `Reward: ${count} super seeds`;
  }
  return count === 1 ? "Reward: 1 seed" : `Reward: ${count} seeds`;
}

