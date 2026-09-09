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

export function closedPeriodKey(status: "DENIED" | "DONE", claimId: string): string {
  return `${status.toLowerCase()}:${claimId}`;
}

/** NONE chores reuse periodKey "open" until the claim is finished (deny or harvest). */
export function recurrenceFreesOnHarvest(recurrence: ChoreRecurrence): boolean {
  return recurrence === "NONE";
}
