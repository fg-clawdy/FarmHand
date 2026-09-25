import { choreSkipGate, SKIP_SHARD_REWARD } from "@farmhand/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { httpError, isPrismaUnique } from "./chores.js";
import { chorePeriod } from "./tz.js";

export { SKIP_SHARD_REWARD };

/**
 * Honest skip: period satisfaction via ChoreClaim status=SKIPPED,
 * +SKIP_SHARD_REWARD seedShards, no provisional seed / no parent inbox.
 */
export async function skipChore(opts: {
  playerId: string;
  choreId: string;
  timezone: string;
  now?: Date;
}) {
  const now = opts.now ?? new Date();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const chore = await tx.chore.findUnique({
            where: { id: opts.choreId },
            include: { assignments: true },
          });
          if (!chore) throw httpError("That chore isn't on the list.", 404);

          const period = chorePeriod(chore.recurrence, opts.timezone, now);
          const hasAssignment = chore.assignments.some((row) => row.playerId === opts.playerId);
          const existing = await tx.choreClaim.findUnique({
            where: {
              choreId_playerId_periodKey: {
                choreId: chore.id,
                playerId: opts.playerId,
                periodKey: period.key,
              },
            },
          });
          const race = await tx.choreRaceSlot.findUnique({
            where: { choreId_periodKey: { choreId: chore.id, periodKey: period.key } },
          });

          const gate = choreSkipGate({
            allowsSkip: chore.allowsSkip,
            isActive: chore.isActive,
            periodEligible: period.eligible,
            assignmentMode: chore.assignmentMode,
            hasAssignment,
            alreadyClaimedByPlayer: Boolean(existing),
            raceTaken: Boolean(race),
          });
          if (!gate.ok) throw httpError(gate.reason);

          await tx.$queryRaw`SELECT id FROM "Player" WHERE id = ${opts.playerId} FOR UPDATE`;

          if (chore.assignmentMode === "RACE") {
            await tx.choreRaceSlot.create({ data: { choreId: chore.id, periodKey: period.key } });
          }

          const claim = await tx.choreClaim.create({
            data: {
              choreId: chore.id,
              playerId: opts.playerId,
              periodKey: period.key,
              status: "SKIPPED",
              resolvedAt: now,
              proofJpegPath: null,
              slot: null,
              plantTier: null,
            },
          });

          const player = await tx.player.update({
            where: { id: opts.playerId },
            data: { seedShards: { increment: SKIP_SHARD_REWARD } },
            include: { plots: { orderBy: { slot: "asc" } } },
          });

          await tx.activityLog.create({
            data: {
              playerId: opts.playerId,
              action: "chore_skip",
              details: {
                choreId: chore.id,
                slug: chore.slug,
                claimId: claim.id,
                shards: SKIP_SHARD_REWARD,
                periodKey: period.key,
              },
            },
          });

          return { claim, chore, player, shardsGranted: SKIP_SHARD_REWARD };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
      );
    } catch (err) {
      lastErr = err;
      if (isPrismaUnique(err)) {
        throw httpError("That chore was already claimed or cleared.");
      }
      const retry =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!retry || attempt === 2) throw err;
    }
  }
  throw lastErr;
}
