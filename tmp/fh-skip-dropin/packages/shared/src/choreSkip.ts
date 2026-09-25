import { choreClaimGate } from "./chores.js";
import { SKIP_SHARD_REWARD } from "./choreCatalog.js";

export { SKIP_SHARD_REWARD };

/**
 * Honest-skip eligibility: allowsSkip + same gates as claim.
 */
export function choreSkipGate(opts: {
  allowsSkip: boolean;
  isActive: boolean;
  periodEligible: boolean;
  assignmentMode: "ALL" | "SPECIFIC" | "RACE";
  hasAssignment: boolean;
  alreadyClaimedByPlayer: boolean;
  raceTaken: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!opts.allowsSkip) {
    return { ok: false, reason: "That chore can't be cleared as not needed." };
  }
  const gate = choreClaimGate({
    isActive: opts.isActive,
    periodEligible: opts.periodEligible,
    assignmentMode: opts.assignmentMode,
    hasAssignment: opts.hasAssignment,
    alreadyClaimedByPlayer: opts.alreadyClaimedByPlayer,
    raceTaken: opts.raceTaken,
  });
  if (!gate.ok) {
    return { ok: false, reason: gate.reason ?? "You can't clear that chore right now." };
  }
  return { ok: true };
}
