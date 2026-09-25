/** Confirmed-first seed spend + parent-notify rate limit helpers (pure). */

export const PARENT_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000;

export type SeedSpendPlan = {
  confirmedUsed: number;
  provisionalUsed: number;
};

export function planSeedSpend(
  confirmedSeeds: number,
  provisionalSeeds: number,
  cost: number,
): SeedSpendPlan {
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error("Invalid seed cost.");
  }
  if (!Number.isFinite(confirmedSeeds) || confirmedSeeds < 0) {
    throw new Error("Invalid confirmed seed count.");
  }
  if (!Number.isFinite(provisionalSeeds) || provisionalSeeds < 0) {
    throw new Error("Invalid provisional seed count.");
  }
  const total = confirmedSeeds + provisionalSeeds;
  if (total < cost) {
    throw new Error("Not enough seeds for that plant.");
  }
  const confirmedUsed = Math.min(confirmedSeeds, cost);
  const provisionalUsed = cost - confirmedUsed;
  return { confirmedUsed, provisionalUsed };
}

export type ClaimSeedBucket = {
  id: string;
  seedsGranted: number;
  seedsPlanted: number;
};

/** FIFO allocate provisional units across pending claim buckets. */
export function allocateProvisionalFromClaims(
  claims: readonly ClaimSeedBucket[],
  provisionalNeeded: number,
): Array<{ claimId: string; seedsUsed: number }> {
  if (provisionalNeeded <= 0) return [];
  let remaining = provisionalNeeded;
  const out: Array<{ claimId: string; seedsUsed: number }> = [];
  for (const claim of claims) {
    if (remaining <= 0) break;
    const available = Math.max(0, claim.seedsGranted - claim.seedsPlanted);
    if (available <= 0) continue;
    const seedsUsed = Math.min(available, remaining);
    out.push({ claimId: claim.id, seedsUsed });
    remaining -= seedsUsed;
  }
  if (remaining > 0) {
    throw new Error("No pending chore claim for provisional seed.");
  }
  return out;
}

export function harvestBlockedWhilePending(pendingLinkedClaimCount: number): boolean {
  return pendingLinkedClaimCount > 0;
}

export function parentNotifyGate(lastNotifyAt: Date | string | null | undefined, now = new Date()) {
  if (!lastNotifyAt) {
    return { allowed: true as const, retryAt: null as string | null, retryInMs: 0 };
  }
  const last = lastNotifyAt instanceof Date ? lastNotifyAt : new Date(lastNotifyAt);
  const elapsed = now.getTime() - last.getTime();
  if (elapsed >= PARENT_NOTIFY_COOLDOWN_MS) {
    return { allowed: true as const, retryAt: null as string | null, retryInMs: 0 };
  }
  const retryInMs = PARENT_NOTIFY_COOLDOWN_MS - elapsed;
  return {
    allowed: false as const,
    retryAt: new Date(last.getTime() + PARENT_NOTIFY_COOLDOWN_MS).toISOString(),
    retryInMs,
  };
}
