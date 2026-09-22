import {
  assignmentModeForSeed,
  choreClaimGate,
  choreOpenForFamily,
  closedPeriodKey,
  compareChoresForKid,
  compareChoresForParent,
  compareClaimsForInbox,
  JOB_BOARD_V1_REWARD_SEED_COUNT,
  recurrenceFreesOnHarvest,
  resolveSeedReward,
  serializePlot,
  type ChorePriority,
  type GameConfig,
} from "@farmhand/shared";
import { Prisma, type Chore, type PrismaClient } from "@prisma/client";
import { prisma } from "./db.js";
import { ensureWantedFlyer, wantedFlyerPublicUrl } from "./wantedFlyer.js";
import { chorePeriod } from "./tz.js";
import { recordAccoladeEvent } from "./accolades.js";
import { loadConfig } from "./game.js";
import { withLockedClaim } from "./locks.js";

export function httpError(message: string, statusCode = 400): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

export function isPrismaUnique(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export const EMPTY_PLOT_DATA = {
  plantTier: null,
  plantedAt: null,
  phase: "empty" as const,
  choreClaimId: null,
  waterReductionMinutes: 0,
  fertilizerReductionMinutes: 0,
  lastWateredAt: null,
  wateringsOnDate: null,
  wateringsCount: 0,
};

type Tx = Prisma.TransactionClient | PrismaClient;

export async function seedChoreCatalog() {
  const { CHORE_CATALOG } = await import("@farmhand/shared");
  for (const [index, row] of CHORE_CATALOG.entries()) {
    const assignmentMode = assignmentModeForSeed(row);
    const existing = await prisma.chore.findUnique({ where: { slug: row.slug } });
    if (!existing) {
      await prisma.chore.create({
        data: {
          slug: row.slug,
          title: row.title,
          emoji: row.emoji,
          description: row.description,
          recurrence: row.recurrence,
          timeOfDay: row.timeOfDay,
          priority: row.priority,
          estimatedMinutes: row.estimatedMinutes,
          requiresApproval: row.requiresApproval,
          requiresSelfie: row.requiresSelfie,
          allowsSkip: row.allowsSkip,
          isGlobal: row.isGlobal,
          includeInPath: row.includeInPath,
          isActive: row.isActive,
          legacyPoints: row.legacyPoints,
          difficulty: row.difficulty,
          seedReward: row.seedReward,
          assignmentMode,
          sortOrder: index + 1,
        },
      });
    }
    await ensureWantedFlyer({
      slug: row.slug,
      title: row.title,
      emoji: row.emoji,
      rewardLabel: "+1 SEED",
    });
  }
  const extras = await prisma.chore.findMany();
  for (const chore of extras) {
    await ensureWantedFlyer({
      slug: chore.slug,
      title: chore.title,
      emoji: chore.emoji,
      rewardLabel: "+1 SEED",
    });
  }
}

export function publicChore(
  chore: Chore & { assignments?: { playerId: string }[] },
  opts: {
    playerId: string;
    timezone: string;
    now?: Date;
    claimedPeriodKeys: Set<string>;
    raceTakenKeys: Set<string>;
  },
) {
  const now = opts.now ?? new Date();
  const period = chorePeriod(chore.recurrence, opts.timezone, now);
  const periodClaimKey = `${chore.id}:${period.key}`;
  const alreadyClaimedByPlayer = opts.claimedPeriodKeys.has(periodClaimKey);
  const raceTaken = opts.raceTakenKeys.has(periodClaimKey);
  const hasAssignment = (chore.assignments ?? []).some((row) => row.playerId === opts.playerId);
  const gate = choreClaimGate({
    isActive: chore.isActive,
    periodEligible: period.eligible,
    assignmentMode: chore.assignmentMode,
    hasAssignment,
    alreadyClaimedByPlayer,
    raceTaken,
  });
  return {
    id: chore.id,
    slug: chore.slug,
    title: chore.title,
    emoji: chore.emoji,
    description: chore.description,
    recurrence: chore.recurrence,
    timeOfDay: chore.timeOfDay,
    priority: chore.priority,
    estimatedMinutes: chore.estimatedMinutes,
    requiresApproval: chore.requiresApproval,
    requiresSelfie: chore.requiresSelfie,
    allowsSkip: chore.allowsSkip,
    isGlobal: chore.isGlobal,
    includeInPath: chore.includeInPath,
    isActive: chore.isActive,
    assignmentMode: chore.assignmentMode,
    sortOrder: chore.sortOrder,
    periodKey: period.key,
    periodEligible: period.eligible,
    eligible: gate.ok,
    reason: gate.ok ? null : gate.reason ?? null,
    claimed: alreadyClaimedByPlayer,
    claimedByOther: chore.assignmentMode === "RACE" && raceTaken && !alreadyClaimedByPlayer,
    flyerUrl: wantedFlyerPublicUrl(chore.slug),
  };
}

export async function listPlayerChores(playerId: string, timezone: string, now = new Date()) {
  const chores = await prisma.chore.findMany({
    include: { assignments: true },
    orderBy: { sortOrder: "asc" },
  });
  const claims = await prisma.choreClaim.findMany({
    where: { playerId },
    select: { choreId: true, periodKey: true },
  });
  const raceSlots = await prisma.choreRaceSlot.findMany({ select: { choreId: true, periodKey: true } });
  const claimedPeriodKeys = new Set(claims.map((row) => `${row.choreId}:${row.periodKey}`));
  const raceTakenKeys = new Set(raceSlots.map((row) => `${row.choreId}:${row.periodKey}`));
  return chores
    .map((chore) => publicChore(chore, { playerId, timezone, now, claimedPeriodKeys, raceTakenKeys }))
    .filter((chore) => chore.isActive)
    .sort(compareChoresForKid);
}

export type FamilyOpenJob = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  priority: ChorePriority;
  assignmentMode: Chore["assignmentMode"];
  requiresSelfie: boolean;
  sortOrder: number;
  rewardSeedCount: number;
  rewardSeedKind?: "seed" | "super_seed";
  rewardLabel?: string;
  flyerUrl: string;
};

export async function listFamilyOpenChores(timezone: string, now = new Date()): Promise<FamilyOpenJob[]> {
  const [chores, players, claims, raceSlots] = await Promise.all([
    prisma.chore.findMany({ include: { assignments: true }, orderBy: { sortOrder: "asc" } }),
    prisma.player.findMany({ where: { isActive: true }, select: { id: true } }),
    prisma.choreClaim.findMany({ select: { choreId: true, playerId: true, periodKey: true } }),
    prisma.choreRaceSlot.findMany({ select: { choreId: true, periodKey: true } }),
  ]);
  const config = await loadConfig();
  const activePlayerIds = players.map((row) => row.id);
  const raceTakenKeys = new Set(raceSlots.map((row) => `${row.choreId}:${row.periodKey}`));
  const jobs: FamilyOpenJob[] = [];
  for (const chore of chores) {
    const period = chorePeriod(chore.recurrence, timezone, now);
    const claimedPlayerIdsThisPeriod = claims
      .filter((row) => row.choreId === chore.id && row.periodKey === period.key)
      .map((row) => row.playerId);
    const open = choreOpenForFamily({
      isActive: chore.isActive,
      periodEligible: period.eligible,
      assignmentMode: chore.assignmentMode,
      assignedPlayerIds: chore.assignments.map((row) => row.playerId),
      activePlayerIds,
      claimedPlayerIdsThisPeriod,
      raceTaken: raceTakenKeys.has(`${chore.id}:${period.key}`),
    });
    if (!open) continue;
    jobs.push({
      id: chore.id,
      slug: chore.slug,
      title: chore.title,
      emoji: chore.emoji,
      description: chore.description,
      priority: chore.priority,
      assignmentMode: chore.assignmentMode,
      requiresSelfie: chore.requiresSelfie,
      sortOrder: chore.sortOrder,
      rewardSeedCount: resolveSeedReward(chore, config),
      rewardSeedKind: "seed",
      flyerUrl: wantedFlyerPublicUrl(chore.slug),
    });
  }
  return jobs.sort(compareChoresForParent);
}

export async function claimChore(opts: {
  playerId: string;
  choreId: string;
  timezone: string;
  config: GameConfig;
  proofPath?: string | null;
  hasProof?: boolean;
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
        const gate = choreClaimGate({
          isActive: chore.isActive,
          periodEligible: period.eligible,
          assignmentMode: chore.assignmentMode,
          hasAssignment,
          alreadyClaimedByPlayer: Boolean(existing),
          raceTaken: Boolean(race),
        });
        if (!gate.ok) throw httpError(gate.reason ?? "You can't claim that chore.");
        if (chore.requiresSelfie && !opts.proofPath && !opts.hasProof) {
          throw httpError("That chore needs a photo for a grown-up to check.");
        }

        // Lock player row
        await tx.$queryRaw`SELECT id FROM "Player" WHERE id = ${opts.playerId} FOR UPDATE`;
        const player = await tx.player.findUniqueOrThrow({
          where: { id: opts.playerId },
        });

        if (chore.assignmentMode === "RACE") {
          await tx.choreRaceSlot.create({ data: { choreId: chore.id, periodKey: period.key } });
        }

        // Create the claim (no slot or plantTier yet — seed goes to pouch)
        const jobSeedReward = resolveSeedReward(chore, config);
        const claim = await tx.choreClaim.create({
          data: {
            choreId: chore.id,
            playerId: opts.playerId,
            periodKey: period.key,
            status: "PENDING",
            proofJpegPath: opts.proofPath ?? null,
            rewardSeedCount: jobSeedReward,
          },
        });

        // Add provisional seeds to pouch
        if (jobSeedReward > 0) {
          await tx.player.update({
            where: { id: opts.playerId },
            data: { provisionalSeeds: { increment: jobSeedReward } },
          });
        }

        await tx.activityLog.create({
          data: {
            playerId: opts.playerId,
            action: "chore_claim",
            details: { choreId: chore.id, slug: chore.slug, claimId: claim.id },
          },
        });
        let unlocks: Awaited<ReturnType<typeof recordAccoladeEvent>> = [];
        if (opts.hasProof || opts.proofPath) {
          unlocks = await recordAccoladeEvent(tx, {
            playerId: opts.playerId,
            timezone: opts.timezone,
            event: { type: "chore_photo" },
          });
        }

        return { claim, chore, playerId: opts.playerId, unlocks };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
    );
    } catch (err) {
      lastErr = err;
      if (isPrismaUnique(err)) {
        throw httpError("That chore was already claimed.");
      }
      const retry =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!retry || attempt === 2) throw err;
    }
  }
  throw lastErr;
}

export async function approveClaim(claimId: string, adminId: string, now = new Date()) {
  return withLockedClaim(claimId, async (tx, lockedClaim) => {
    // Re-read claim status AFTER lock — prevents concurrent approve/deny
    // from both acting on the same PENDING claim.
    if (lockedClaim.status !== "PENDING") throw httpError("A grown-up already handled that one.");

    await tx.choreClaim.update({
      where: { id: claimId },
      data: { status: "APPROVED", resolvedAt: now, resolvedByAdminId: adminId },
    });

    // If claim has a linked plot (kid already planted the provisional seed),
    // transition purgatory -> growing
    const plot = await tx.plot.findFirst({
      where: { choreClaimId: claimId },
    });
    if (plot) {
      await tx.plot.update({
        where: { id: plot.id },
        data: {
          phase: "growing",
          plantedAt: now,
          plantTier: lockedClaim.plantTier ?? 1,
          waterReductionMinutes: 0,
          fertilizerReductionMinutes: 0,
          lastWateredAt: null,
          wateringsOnDate: null,
          wateringsCount: 0,
        },
      });
    } else {
      // No plot yet — convert provisional seed to approved seed
      await tx.player.update({
        where: { id: lockedClaim.playerId },
        data: {
          provisionalSeeds: { decrement: 1 },
          seeds: { increment: 1 },
        },
      });
    }

    await tx.activityLog.create({
      data: {
        playerId: lockedClaim.playerId,
        action: "chore_approve",
        details: { claimId, choreId: lockedClaim.choreId, slug: lockedClaim.choreId, slot: plot?.slot ?? null },
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        targetPlayerId: lockedClaim.playerId,
        action: "chore_approve",
        details: { claimId, slug: lockedClaim.choreId },
      },
    });
    const config = await loadConfig();
    await recordAccoladeEvent(tx, {
      playerId: lockedClaim.playerId,
      timezone: config.timezone,
      event: { type: "planting" },
      now,
    });
    return { claim: { ...lockedClaim, status: "APPROVED" } as typeof lockedClaim, plot };
  });
}

export async function denyClaim(claimId: string, adminId: string) {
  return withLockedClaim(claimId, async (tx, lockedClaim) => {
    // Re-read claim status AFTER lock — prevents concurrent approve/deny
    // from both acting on the same PENDING claim.
    if (lockedClaim.status !== "PENDING") throw httpError("A grown-up already handled that one.");
    const plot = await tx.plot.findFirst({
      where: { choreClaimId: claimId },
    });
    const originalKey = lockedClaim.periodKey;
    await tx.choreClaim.update({
      where: { id: claimId },
      data: {
        status: "DENIED",
        resolvedAt: new Date(),
        resolvedByAdminId: adminId,
        periodKey: closedPeriodKey("DENIED", claimId),
      },
    });
    // We need the chore for the assignmentMode check — read it separately
    const chore = await tx.chore.findUniqueOrThrow({ where: { id: lockedClaim.choreId } });
    if (chore.assignmentMode === "RACE") {
      await tx.choreRaceSlot.deleteMany({ where: { choreId: lockedClaim.choreId, periodKey: originalKey } });
    }
    if (plot) {
      // Plant already placed — wilt it
      await tx.plot.update({
        where: { id: plot.id },
        data: {
          phase: "wilted",
          plantedAt: null,
          plantTier: lockedClaim.plantTier ?? 1,
        },
      });
    } else {
      // No plot yet — remove provisional seed from pouch
      await tx.player.update({
        where: { id: lockedClaim.playerId },
        data: { provisionalSeeds: { decrement: 1 } },
      });
    }
    await tx.activityLog.create({
      data: {
        playerId: lockedClaim.playerId,
        action: "chore_deny",
        details: { claimId, choreId: lockedClaim.choreId, slug: lockedClaim.choreId, slot: plot?.slot ?? null },
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        targetPlayerId: lockedClaim.playerId,
        action: "chore_deny",
        details: { claimId, slug: lockedClaim.choreId },
      },
    });
    return { claim: { ...lockedClaim, status: "DENIED" } as typeof lockedClaim, plot };
  });
}

export async function prunePlot(playerId: string, slot: number, config: GameConfig) {
  return prisma.$transaction(async (tx) => {
    const player = await tx.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { plots: true },
    });
    const plot = player.plots.find((p) => p.slot === slot);
    if (!plot) throw httpError("No plot there.", 404);
    const serialized = serializePlot(plot, config);
    if (serialized.state !== "wilted") {
      throw httpError("Only wilted plants can be pruned.");
    }
    await tx.plot.update({
      where: { id: plot.id },
      data: EMPTY_PLOT_DATA,
    });
    await tx.activityLog.create({
      data: { playerId, action: "plot_prune", details: { slot, claimId: plot.choreClaimId } },
    });
    return tx.player.findUniqueOrThrow({
      where: { id: playerId },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
  });
}

export async function releaseClaimIfNeeded(
  tx: Tx,
  plot: { choreClaimId: string | null },
  event: "harvest",
) {
  if (!plot.choreClaimId) return;
  const claim = await tx.choreClaim.findUnique({
    where: { id: plot.choreClaimId },
    include: { chore: true },
  });
  if (!claim) return;
  if (event === "harvest" && recurrenceFreesOnHarvest(claim.chore.recurrence)) {
    const originalKey = claim.periodKey;
    await tx.choreClaim.update({
      where: { id: claim.id },
      data: { periodKey: closedPeriodKey("DONE", claim.id) },
    });
    if (claim.chore.assignmentMode === "RACE") {
      await tx.choreRaceSlot.deleteMany({ where: { choreId: claim.choreId, periodKey: originalKey } });
    }
  }
}

export async function listParentInbox() {
  const claims = await prisma.choreClaim.findMany({
    where: { status: "PENDING" },
    include: { chore: true, player: true },
  });
  const rows = claims
    .map((claim) => ({
      id: claim.id,
      status: claim.status,
      slot: claim.slot,
      plantTier: claim.plantTier,
      periodKey: claim.periodKey,
      claimedAt: claim.claimedAt,
      hasPhoto: Boolean(claim.proofJpegPath),
      priority: claim.chore.priority as ChorePriority,
      chore: {
        id: claim.chore.id,
        slug: claim.chore.slug,
        title: claim.chore.title,
        emoji: claim.chore.emoji,
        description: claim.chore.description,
        priority: claim.chore.priority,
        requiresSelfie: claim.chore.requiresSelfie,
      },
      player: {
        id: claim.player.id,
        name: claim.player.name,
        mascot: claim.player.mascot,
      },
    }))
    .sort(compareClaimsForInbox);
  return rows;
}
