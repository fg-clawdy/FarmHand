import { walletFromLedger, type StarLedgerKind, type StarWallet } from "@farmhand/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";

type Db = Prisma.TransactionClient | typeof prisma;

export type LedgerWrite = {
  playerId: string;
  kind: StarLedgerKind;
  amount: number;
  idempotencyKey: string;
  redemptionId?: string | null;
  source?: string;
  meta?: Prisma.InputJsonValue;
};

export async function appendStarEvent(tx: Db, row: LedgerWrite) {
  try {
    return await tx.starLedgerEvent.create({
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
      return tx.starLedgerEvent.findUniqueOrThrow({ where: { idempotencyKey: row.idempotencyKey } });
    }
    throw err;
  }
}

export async function starsHeldForPlayer(playerId: string, tx: Db = prisma) {
  const agg = await tx.storeRedemption.aggregate({
    where: { playerId, status: "PENDING" },
    _sum: { starsHeld: true },
  });
  return agg._sum.starsHeld ?? 0;
}

export async function playerWallet(playerId: string, tx: Db = prisma): Promise<StarWallet> {
  const [lines, held] = await Promise.all([
    tx.starLedgerEvent.findMany({
      where: { playerId },
      select: { kind: true, amount: true },
    }),
    starsHeldForPlayer(playerId, tx),
  ]);
  return walletFromLedger(lines, held);
}

export function publicWallet(wallet: StarWallet) {
  return {
    currentStars: wallet.currentStars,
    points: wallet.currentStars,
    heldStars: wallet.heldStars,
    starsHeld: wallet.heldStars,
    availableStars: wallet.availableStars,
    lifetimeEarned: wallet.lifetimeEarned,
    lifetimeEarnedHarvest: wallet.lifetimeEarnedHarvest,
    lifetimeEarnedGrant: wallet.lifetimeEarnedGrant,
    lifetimeEarnedLegacy: wallet.lifetimeEarnedLegacy,
    lifetimeSpent: wallet.lifetimeSpent,
    adjustNet: wallet.adjustNet,
  };
}

export async function recordOpeningBalance(tx: Db, playerId: string, amount: number, source = "create_player") {
  if (!Number.isInteger(amount) || amount < 1) return null;
  return appendStarEvent(tx, {
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
