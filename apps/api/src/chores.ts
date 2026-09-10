import {
  assignmentModeForSeed,
  choreClaimGate,
  choreOpenForFamily,
  closedPeriodKey,
  compareChoresForKid,
  compareChoresForParent,
  compareClaimsForInbox,
  getTier,
  JOB_BOARD_V1_REWARD_SEED_COUNT,
  plotIsEmpty,
  recurrenceFreesOnHarvest,
  serializePlot,
  type ChorePriority,
  type GameConfig,
} from "@farmhand/shared";
import { Prisma, type Chore, type PrismaClient } from "@prisma/client";
import { prisma } from "./db.js";
import { chorePeriod } from "./tz.js";
import { recordAccoladeEvent } from "./accolades.js";
import { loadConfig } from "./game.js";

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
    if (existing) continue;
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
        assignmentMode,
        sortOrder: index + 1,
      },
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
};

export async function listFamilyOpenChores(timezone: string, now = new Date()): Promise<FamilyOpenJob[]> {
  const [chores, players, claims, raceSlots] = await Promise.all([
    prisma.chore.findMany({ include: { assignments: true }, orderBy: { sortOrder: "asc" } }),
    prisma.player.findMany({ where: { isActive: true }, select: { id: true } }),
    prisma.choreClaim.findMany({ select: { choreId: true, playerId: true, periodKey: true } }),
    prisma.choreRaceSlot.findMany({ select: { choreId: true, periodKey: true } }),
  ]);
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
      rewardSeedCount: JOB_BOARD_V1_REWARD_SEED_COUNT,
      rewardSeedKind: "seed",
    });
  }
  return jobs.sort(compareChoresForParent);
}

export async function claimChore(opts: {
  playerId: string;
  choreId: string;
  slot: number;
  tier: number;
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

        if (!Number.isInteger(opts.slot) || opts.slot < 0 || opts.slot >= opts.config.plotCount) {
          throw httpError("No plot there.", 404);
        }
        const plantTier = getTier(opts.config, opts.tier);
        const player = await tx.player.findUniqueOrThrow({
          where: { id: opts.playerId },
          include: { plots: true },
        });
        const plot =
          player.plots.find((p) => p.slot === opts.slot) ??
          (await tx.plot.create({ data: { playerId: player.id, slot: opts.slot } }));
        await tx.$queryRaw`SELECT id FROM "Plot" WHERE id = ${plot.id} FOR UPDATE`;
        const locked = await tx.plot.findUniqueOrThrow({ where: { id: plot.id } });
        if (!plotIsEmpty(locked)) {
          throw httpError("Need an empty plot to plant your chore seed.");
        }

        if (chore.assignmentMode === "RACE") {
          await tx.choreRaceSlot.create({ data: { choreId: chore.id, periodKey: period.key } });
        }

        const claim = await tx.choreClaim.create({
          data: {
            choreId: chore.id,
            playerId: opts.playerId,
            periodKey: period.key,
            status: "PENDING",
            slot: opts.slot,
            plantTier: plantTier.tier,
            proofJpegPath: opts.proofPath ?? null,
          },
        });

        await tx.plot.update({
          where: { id: locked.id },
          data: {
            plantTier: plantTier.tier,
            plantedAt: null,
            phase: "purgatory",
            choreClaimId: claim.id,
            waterReductionMinutes: 0,
            fertilizerReductionMinutes: 0,
            lastWateredAt: null,
            wateringsOnDate: null,
            wateringsCount: 0,
          },
        });

        await tx.activityLog.create({
          data: {
            playerId: opts.playerId,
            action: "chore_claim",
            details: { choreId: chore.id, slug: chore.slug, slot: opts.slot, claimId: claim.id },
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
  return prisma.$transaction(async (tx) => {
    const claim = await tx.choreClaim.findUnique({
      where: { id: claimId },
      include: { chore: true, plot: true, player: { include: { plots: true } } },
    });
    if (!claim) throw httpError("That claim is gone.", 404);
    if (claim.status !== "PENDING") throw httpError("A grown-up already handled that one.");
    const plot = claim.plot ?? claim.player.plots.find((p) => p.choreClaimId === claim.id);
    if (!plot) throw httpError("That plant isn't in the garden anymore.");
    await tx.choreClaim.update({
      where: { id: claim.id },
      data: { status: "APPROVED", resolvedAt: now, resolvedByAdminId: adminId },
    });
    await tx.plot.update({
      where: { id: plot.id },
      data: {
        phase: "growing",
        plantedAt: now,
        plantTier: claim.plantTier,
        waterReductionMinutes: 0,
        fertilizerReductionMinutes: 0,
        lastWateredAt: null,
        wateringsOnDate: null,
        wateringsCount: 0,
      },
    });
    await tx.activityLog.create({
      data: {
        playerId: claim.playerId,
        action: "chore_approve",
        details: { claimId: claim.id, choreId: claim.choreId, slug: claim.chore.slug, slot: plot.slot },
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        targetPlayerId: claim.playerId,
        action: "chore_approve",
        details: { claimId: claim.id, slug: claim.chore.slug },
      },
    });
    const config = await loadConfig();
    await recordAccoladeEvent(tx, {
      playerId: claim.playerId,
      timezone: config.timezone,
      event: { type: "planting" },
      now,
    });
    return { claim, plot };
  });
}

export async function denyClaim(claimId: string, adminId: string) {
  return prisma.$transaction(async (tx) => {
    const claim = await tx.choreClaim.findUnique({
      where: { id: claimId },
      include: { chore: true, plot: true, player: { include: { plots: true } } },
    });
    if (!claim) throw httpError("That claim is gone.", 404);
    if (claim.status !== "PENDING") throw httpError("A grown-up already handled that one.");
    const plot = claim.plot ?? claim.player.plots.find((p) => p.choreClaimId === claim.id);
    const originalKey = claim.periodKey;
    await tx.choreClaim.update({
      where: { id: claim.id },
      data: {
        status: "DENIED",
        resolvedAt: new Date(),
        resolvedByAdminId: adminId,
        periodKey: closedPeriodKey("DENIED", claim.id),
      },
    });
    if (claim.chore.assignmentMode === "RACE") {
      await tx.choreRaceSlot.deleteMany({ where: { choreId: claim.choreId, periodKey: originalKey } });
    }
    if (plot) {
      await tx.plot.update({
        where: { id: plot.id },
        data: {
          phase: "wilted",
          plantedAt: null,
          plantTier: claim.plantTier,
        },
      });
    }
    await tx.activityLog.create({
      data: {
        playerId: claim.playerId,
        action: "chore_deny",
        details: { claimId: claim.id, choreId: claim.choreId, slug: claim.chore.slug, slot: plot?.slot ?? claim.slot },
      },
    });
    await tx.auditLog.create({
      data: {
        adminId,
        targetPlayerId: claim.playerId,
        action: "chore_deny",
        details: { claimId: claim.id, slug: claim.chore.slug },
      },
    });
    return { claim, plot };
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
