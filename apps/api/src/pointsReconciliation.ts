import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { computePointsForPlayer } from "./points.js";
import { withSerializableRetry } from "./locks.js";

type Db = Prisma.TransactionClient | typeof prisma;

/** Alert kind raised when the stored balance disagrees with the ledger. */
export const POINT_LEDGER_MISMATCH_KIND = "POINT_LEDGER_MISMATCH";

/**
 * Pure reconciliation decision. `delta` is `ledgerPoints - storedPoints`, so a
 * positive value means the stored column lags behind the canonical ledger.
 * Factored out of the transaction body so it can be unit-tested without a DB.
 */
export function decideReconciliation(
  ledgerPoints: number,
  storedPoints: number,
): { matched: boolean; ledgerPoints: number; storedPoints: number; delta: number } {
  return { matched: ledgerPoints === storedPoints, ledgerPoints, storedPoints, delta: ledgerPoints - storedPoints };
}

export type ReconcileOutcome =
  | { matched: true; points: number; repaired: false }
  | { matched: false; ledgerPoints: number; storedPoints: number; repaired: boolean; alertId: string };

/**
 * Compare `Player.points` against `computePointsFromLedger`, append an
 * immutable run row (watermark = newest ledger `idempotencyKey`), and raise a
 * `SystemAlert` on mismatch. Repair only happens when explicitly requested.
 * Runs inside an already-open transaction; the caller owns the transaction.
 */
export async function reconcilePointsForPlayer(
  tx: Db,
  playerId: string,
  opts: { repair?: boolean } = {},
): Promise<ReconcileOutcome> {
  const ledgerPoints = await computePointsForPlayer(tx, playerId);
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  const storedPoints = player.points;
  const decision = decideReconciliation(ledgerPoints, storedPoints);

  const newest = await tx.pointLedgerEvent.findFirst({
    where: { playerId },
    orderBy: { createdAt: "desc" },
    select: { idempotencyKey: true },
  });
  const ledgerHighWater = newest?.idempotencyKey ?? null;

  if (decision.matched) {
    await tx.pointsReconciliationRun.create({
      data: { playerId, ledgerPoints, storedPoints, matched: true, repaired: false, ledgerHighWater },
    });
    return { matched: true, points: ledgerPoints, repaired: false };
  }

  if (opts.repair === true) {
    await tx.player.update({ where: { id: playerId }, data: { points: ledgerPoints } });
  }

  const alert = await tx.systemAlert.create({
    data: {
      kind: POINT_LEDGER_MISMATCH_KIND,
      severity: "critical",
      message: `Player ${player.name} (${playerId}) stored points ${storedPoints} != ledger ${ledgerPoints}.`,
      details: { ledgerPoints, storedPoints, delta: decision.delta, repaired: opts.repair === true },
      playerId,
    },
  });

  await tx.pointsReconciliationRun.create({
    data: {
      playerId,
      ledgerPoints,
      storedPoints,
      matched: false,
      repaired: opts.repair === true,
      ledgerHighWater,
    },
  });

  return { matched: false, ledgerPoints, storedPoints, repaired: opts.repair === true, alertId: alert.id };
}

/**
 * Run a points mutation inside a single Serializable transaction (with retry).
 * This is the primitive every reconcile / repair write goes through.
 */
export async function withPointsTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return withSerializableRetry(() =>
    prisma.$transaction(fn, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: 12_000,
    }),
  );
}

export type ReconcileBatchSummary = { checked: number; mismatches: number; repaired: number };

/** Reconcile every active player; return a count summary for the admin route. */
export async function reconcileAllActivePlayers(opts: { repair?: boolean } = {}): Promise<ReconcileBatchSummary> {
  const players = await prisma.player.findMany({ where: { isActive: true }, select: { id: true } });
  let mismatches = 0;
  let repaired = 0;
  for (const p of players) {
    const outcome = await withPointsTransaction((tx) => reconcilePointsForPlayer(tx, p.id, opts));
    if (!outcome.matched) {
      mismatches += 1;
      if (outcome.repaired) repaired += 1;
    }
  }
  return { checked: players.length, mismatches, repaired };
}