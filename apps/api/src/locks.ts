import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./db.js";

type Tx = Prisma.TransactionClient;

/**
 * Retry a Serializable transaction up to 3 times on P2034
 * (serialization failure / write conflict).
 */
export async function withSerializableRetry<T>(run: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await run();
    } catch (err) {
      lastErr = err;
      const retry = err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!retry || attempt === 2) throw err;
    }
  }
  throw lastErr;
}

/**
 * Lock a specific Plot row inside a Serializable transaction.
 *
 * The caller receives the **re-read** row (after FOR UPDATE), so
 * validation gates happen against the locked, current state.
 */
export async function withLockedPlot<T>(
  playerId: string,
  slot: number,
  fn: (tx: Tx, plot: { id: string; slot: number; plantTier: number | null; plantedAt: Date | null; phase: string; wateringsOnDate: string | null; wateringsCount: number; lastWateredAt: Date | null; waterReductionMinutes: number; fertilizerReductionMinutes: number; choreClaimId: string | null }) => Promise<T>,
): Promise<T> {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        // Lock the plot row
        const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM "Plot" WHERE "playerId" = $1 AND "slot" = $2 FOR UPDATE`,
          playerId,
          slot,
        );
        if (rows.length === 0) {
          throw Object.assign(new Error("No plot there."), { statusCode: 404 });
        }
        // Re-read after lock
        const plot = await tx.plot.findUniqueOrThrow({
          where: { id: rows[0]!.id },
        });
        return fn(tx, plot);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
    ),
  );
}

/**
 * Lock a Player row inside a Serializable transaction.
 *
 * Returns the re-read player row so callers validate against locked state.
 */
export async function withLockedPlayer<T>(
  playerId: string,
  fn: (tx: Tx, player: { id: string; seeds: number; provisionalSeeds: number; points: number; fertilizer: number; moonDew: number; growGoo: number; phoenixAsh: number; lastIngredientClaimDate: string | null; nextIngredientIndex: number; selfieSeedGrantDate: string | null; selfieUnlockDate: string | null }) => Promise<T>,
): Promise<T> {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT id FROM "Player" WHERE id = $1 FOR UPDATE`,
          playerId,
        );
        // Re-read after lock
        const player = await tx.player.findUniqueOrThrow({
          where: { id: playerId },
        });
        return fn(tx, player);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
    ),
  );
}

/**
 * Lock a ChoreClaim row inside a Serializable transaction.
 *
 * Returns the re-read claim so approval/denial gates validate against locked state.
 */
export async function withLockedClaim<T>(
  claimId: string,
  fn: (tx: Tx, claim: { id: string; status: string; playerId: string; choreId: string; slot: number | null; plantTier: number | null; periodKey: string; proofJpegPath: string | null }) => Promise<T>,
): Promise<T> {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT id FROM "ChoreClaim" WHERE id = $1 FOR UPDATE`,
          claimId,
        );
        // Re-read after lock
        const claim = await tx.choreClaim.findUniqueOrThrow({
          where: { id: claimId },
        });
        return fn(tx, claim);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
    ),
  );
}
