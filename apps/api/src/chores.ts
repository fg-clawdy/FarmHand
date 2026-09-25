import {
  assignmentModeForSeed,
  choreClaimGate,
  choreOpenForFamily,
  closedPeriodKey,
  compareChoresForKid,
  compareChoresForParent,
  compareClaimsForInbox,
  DEFAULT_GAME_CONFIG,
  formatWantedSeedLabel,
  JOB_BOARD_V1_REWARD_SEED_COUNT,
  recurrenceFreesOnHarvest,
  resolveSeedReward,
  serializePlot,
  type ChorePriority,
  type GameConfig,
} from "@farmhand/shared";
import { Prisma, type Chore, type PrismaClient } from "@prisma/client";
import { prisma } from "./db.js";
import { generateWantedFlyer, wantedFlyerPublicUrl } from "./wantedFlyer.js";
import { chorePeriod } from "./tz.js";
import { recordAccoladeEvent } from "./accolades.js";
import { loadConfig } from "./game.js";
import { withLockedClaim } from "./locks.js";
import { bumpHeatOnClaim, loadHeatByChoreId } from "./choreHeat.js";

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

/** Band payout for a catalog row, using the live config when it is available. */
export function catalogSeedCount(
  row: { seedReward?: number | null; difficulty?: number | null },
  config: GameConfig = DEFAULT_GAME_CONFIG,
): number {
  return resolveSeedReward(row, config);
}

export async function seedChoreCatalog() {
  const { CHORE_CATALOG } = await import("@farmhand/shared");
  const config = await loadConfig().catch(() => DEFAULT_GAME_CONFIG);
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
    } else {
      // Keep parent edits for emoji/etc. Refresh schedule, and fill difficulty
      // only when the row never got one — a parent seedReward override stays.
      await prisma.chore.update({
        where: { slug: row.slug },
        data: {
          title: row.title,
          recurrence: row.recurrence,
          timeOfDay: row.timeOfDay,
          includeInPath: row.includeInPath,
          priority: row.priority,
          isGlobal: row.isGlobal,
          allowsSkip: row.allowsSkip,
          assignmentMode,
          ...(existing.difficulty == null && row.difficulty != null ? { difficulty: row.difficulty } : {}),
        },
      });
    }
    const stored = existing
      ? {
          seedReward: existing.seedReward,
          difficulty: existing.difficulty ?? row.difficulty,
        }
      : row;
    await generateWantedFlyer({
      slug: row.slug,
      title: row.title,
      emoji: row.emoji,
      rewardLabel: formatWantedSeedLabel(catalogSeedCount(stored, config)),
    });
  }
  // Deduped into dishes-1-6 — hide legacy empty-dishwasher if it was seeded.
  await prisma.chore.updateMany({
    where: { slug: "empty-dishwasher" },
    data: { isActive: false },
  });

  const extras = await prisma.chore.findMany();
  for (const chore of extras) {
    if (CHORE_CATALOG.some((row) => row.slug === chore.slug)) continue;
    await generateWantedFlyer({
      slug: chore.slug,
      title: chore.title,
      emoji: chore.emoji,
      rewardLabel: formatWantedSeedLabel(resolveSeedReward(chore, config)),
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
    heatByChoreId?: Record<string, number>;
    config: GameConfig;
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
    heatScore: opts.heatByChoreId?.[chore.id] ?? 0,
    rewardSeedCount: resolveSeedReward(chore, opts.config),
    rewardSeedKind: "seed" as const,
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
  const heatByChoreId = await loadHeatByChoreId();
  const config = await loadConfig();
  return chores
    .map((chore) => publicChore(chore, { playerId, timezone, now, claimedPeriodKeys, raceTakenKeys, heatByChoreId, config }))
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
  allowsSkip: boolean;
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
      allowsSkip: chore.allowsSkip,
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
      const result = await prisma.$transaction(
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
        const jobSeedReward = resolveSeedReward(chore, opts.config);
        const claim = await tx.choreClaim.create({
          data: {
            choreId: chore.id,
            playerId: opts.playerId,
            periodKey: period.key,
            status: "PENDING",
            proofJpegPath: opts.proofPath ?? null,
            seedsGranted: Math.max(0, jobSeedReward),
            seedsPlanted: 0,
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

        return { claim, chore, playerId: opts.playerId, unlocks, seedsGranted: jobSeedReward };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
    );
      // HEAT_CLAIM_BUMP — after successful commit (do not run inside serializable tx)
      void bumpHeatOnClaim({ choreId: result.chore.id, playerId: result.playerId }).catch(() => undefined);
      return result;
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

    const links = await tx.plotClaimLink.findMany({
      where: { claimId },
      include: { plot: { include: { claimLinks: { include: { claim: true } } } } },
    });
    const seedsGranted = Math.max(0, lockedClaim.seedsGranted ?? 1);
    const seedsPlanted = Math.min(seedsGranted, Math.max(0, lockedClaim.seedsPlanted ?? 0));
    const unplanted = Math.max(0, seedsGranted - seedsPlanted);

    // Unplanted provisional seeds convert to confirmed pouch seeds.
    if (unplanted > 0) {
      await tx.player.update({
        where: { id: lockedClaim.playerId },
        data: {
          provisionalSeeds: { decrement: unplanted },
          seeds: { increment: unplanted },
        },
      });
    }

    // Plants already growing keep their clock. Clear legacy purgatory phase once no PENDING links remain.
    let plot = links[0]?.plot ?? await tx.plot.findFirst({ where: { choreClaimId: claimId } });
    for (const link of links) {
      const stillPending = link.plot.claimLinks.some(
        (other) => other.claimId !== claimId && other.claim.status === "PENDING",
      );
      if (!stillPending && link.plot.phase === "purgatory") {
        await tx.plot.update({
          where: { id: link.plot.id },
          data: {
            phase: "growing",
            plantedAt: link.plot.plantedAt ?? now,
          },
        });
      }
    }
    if (!plot) {
      plot = null;
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
    const links = await tx.plotClaimLink.findMany({
      where: { claimId },
      include: {
        plot: {
          include: { claimLinks: true },
        },
      },
    });
    const legacyPlot = await tx.plot.findFirst({ where: { choreClaimId: claimId } });
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

    const wiltedPlotIds = new Set<string>();
    for (const link of links) wiltedPlotIds.add(link.plotId);
    if (legacyPlot) wiltedPlotIds.add(legacyPlot.id);

    if (wiltedPlotIds.size > 0) {
      // Deny → wilt every plant funded by this claim (preserve prior semantics).
      for (const plotId of wiltedPlotIds) {
        const plotRow = links.find((l) => l.plotId === plotId)?.plot ?? legacyPlot;
        await tx.plot.update({
          where: { id: plotId },
          data: {
            phase: "wilted",
            plantedAt: null,
            plantTier: plotRow?.plantTier ?? lockedClaim.plantTier ?? 1,
          },
        });
      }

      // Restore other still-pending claims' planted units that were on wilted plots back to the pouch.
      const siblingLinks = await tx.plotClaimLink.findMany({
        where: { plotId: { in: [...wiltedPlotIds] }, claimId: { not: claimId } },
        include: { claim: true },
      });
      let restored = 0;
      for (const sibling of siblingLinks) {
        if (sibling.claim.status !== "PENDING") continue;
        restored += sibling.seedsUsed;
        await tx.choreClaim.update({
          where: { id: sibling.claimId },
          data: { seedsPlanted: { decrement: sibling.seedsUsed } },
        });
      }
      await tx.plotClaimLink.deleteMany({ where: { plotId: { in: [...wiltedPlotIds] } } });
      if (restored > 0) {
        await tx.player.update({
          where: { id: lockedClaim.playerId },
          data: { provisionalSeeds: { increment: restored } },
        });
      }
      // Denied claim's still-unplanted provisional units leave the pouch too.
      {
        const seedsGranted = Math.max(0, lockedClaim.seedsGranted ?? 1);
        const seedsPlanted = Math.min(seedsGranted, Math.max(0, lockedClaim.seedsPlanted ?? 0));
        const unplanted = Math.max(0, seedsGranted - seedsPlanted);
        if (unplanted > 0) {
          await tx.player.update({
            where: { id: lockedClaim.playerId },
            data: { provisionalSeeds: { decrement: unplanted } },
          });
        }
      }
    } else {
      // No plot yet — remove remaining unplanted provisional seeds from pouch
      const seedsGranted = Math.max(0, lockedClaim.seedsGranted ?? 1);
      const seedsPlanted = Math.min(seedsGranted, Math.max(0, lockedClaim.seedsPlanted ?? 0));
      const unplanted = Math.max(0, seedsGranted - seedsPlanted);
      if (unplanted > 0) {
        await tx.player.update({
          where: { id: lockedClaim.playerId },
          data: { provisionalSeeds: { decrement: unplanted } },
        });
      }
    }
    const plot = legacyPlot ?? links[0]?.plot ?? null;
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
      include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            } },
    });
  });
}

export async function releaseClaimIfNeeded(
  tx: Tx,
  plot: { id?: string; choreClaimId: string | null },
  event: "harvest",
) {
  const claimIds = new Set<string>();
  if (plot.choreClaimId) claimIds.add(plot.choreClaimId);
  if (plot.id) {
    const links = await tx.plotClaimLink.findMany({ where: { plotId: plot.id }, select: { claimId: true } });
    for (const link of links) claimIds.add(link.claimId);
  }
  for (const claimId of claimIds) {
    const claim = await tx.choreClaim.findUnique({
      where: { id: claimId },
      include: { chore: true },
    });
    if (!claim) continue;
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
  if (plot.id) {
    await tx.plotClaimLink.deleteMany({ where: { plotId: plot.id } });
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
