import { computePointsFromLedger, walletFromLedger, type PointLedgerKind, type PointWallet } from "@farmhand/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

type Db = Prisma.TransactionClient | typeof prisma;

export type LedgerWrite = {
  playerId: string;
  kind: PointLedgerKind;
  amount: number;
  idempotencyKey: string;
  redemptionId?: string | null;
  source?: string;
  meta?: Prisma.InputJsonValue;
};

export async function appendPointEvent(tx: Db, row: LedgerWrite) {
  try {
    return await tx.pointLedgerEvent.create({
      data: {
        playerId: row.playerId,
        kind: row.kind,
        amount: row.amount,
        idempotencyKey: row.idempotencyKey,
        redemptionId: row.redemptionId ?? null,
        source: row.source ?? "",
        meta: row.meta,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return tx.pointLedgerEvent.findUniqueOrThrow({ where: { idempotencyKey: row.idempotencyKey } });
    }
    throw err;
  }
}

export async function pointsHeldForPlayer(playerId: string, tx: Db = prisma) {
  const agg = await tx.storeRedemption.aggregate({
    where: { playerId, status: "PENDING" },
    _sum: { pointsHeld: true },
  });
  return agg._sum.pointsHeld ?? 0;
}

/** Canonical points for a player, computed from the append-only ledger. */
export async function computePointsForPlayer(tx: Db, playerId: string): Promise<number> {
  const rows = await tx.pointLedgerEvent.findMany({
    where: { playerId },
    select: { kind: true, amount: true },
  });
  return computePointsFromLedger(rows);
}

export async function playerWallet(playerId: string, tx: Db = prisma): Promise<PointWallet> {
  const [lines, held] = await Promise.all([
    tx.pointLedgerEvent.findMany({
      where: { playerId },
      select: { kind: true, amount: true },
    }),
    pointsHeldForPlayer(playerId, tx),
  ]);
  return walletFromLedger(lines, held);
}

export function publicWallet(wallet: PointWallet) {
  return {
    points: wallet.points,
    heldPoints: wallet.heldPoints,
    availablePoints: wallet.availablePoints,
    lifetimeEarned: wallet.lifetimeEarned,
    lifetimeEarnedHarvest: wallet.lifetimeEarnedHarvest,
    lifetimeEarnedGrant: wallet.lifetimeEarnedGrant,
    lifetimeEarnedLegacy: wallet.lifetimeEarnedLegacy,
    lifetimeSpent: wallet.lifetimeSpent,
    lifetimeGiven: wallet.lifetimeGiven,
    adjustNet: wallet.adjustNet,
  };
}

export async function recordOpeningBalance(tx: Db, playerId: string, amount: number, source = "create_player") {
  if (!Number.isInteger(amount) || amount < 1) return null;
  return appendPointEvent(tx, {
    playerId,
    kind: "OPENING_BALANCE",
    amount,
    idempotencyKey: `opening:${playerId}`,
    source,
  });
}

export async function appendRewardEvent(
  tx: Db,
  opts: { redemptionId: string; fromStatus: string | null; toStatus: string; adminId?: string | null; note?: string },
) {
  return tx.storeRewardEvent.create({
    data: {
      redemptionId: opts.redemptionId,
      fromStatus: opts.fromStatus,
      toStatus: opts.toStatus,
      adminId: opts.adminId ?? null,
      note: opts.note ?? "",
    },
  });
}
