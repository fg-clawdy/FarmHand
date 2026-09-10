import type { ChoreAssignmentMode, ChoreRecurrence } from "./choreCatalog.js";

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

export type JobBoardRewardKind = "seed" | "super_seed";

/** v1: every job-board claim plants exactly 1 provisional seed. */
export const JOB_BOARD_V1_REWARD_SEED_COUNT = 1;

export type JobBoardRewardFields = {
  rewardSeedCount?: number;
  rewardSeedKind?: JobBoardRewardKind;
  rewardLabel?: string;
};

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

