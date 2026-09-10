import { STARTER_STORE_CATALOG, canAfford, spendHeldStars } from "@farmhand/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { httpError } from "./chores.js";
import {
  appendRewardEvent,
  appendStarEvent,
  playerWallet,
  publicWallet,
  starsHeldForPlayer,
} from "./stars.js";

type Tx = Prisma.TransactionClient;

const redemptionInclude = {
  sku: true,
  player: { select: { id: true, name: true, mascot: true } },
} as const;

async function withSerializableRetry<T>(run: () => Promise<T>): Promise<T> {
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

export async function seedStoreCatalog() {
  for (const row of STARTER_STORE_CATALOG) {
    const existing = await prisma.storeSku.findUnique({ where: { slug: row.slug } });
    if (existing) continue;
    await prisma.storeSku.create({
      data: {
        slug: row.slug,
        title: row.title,
        emoji: row.emoji,
        description: row.description,
        starCost: row.starCost,
        isActive: true,
        sortOrder: row.sortOrder,
      },
    });
  }
}

export function publicSku(row: {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  starCost: number;
  isActive: boolean;
  sortOrder: number;
}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    emoji: row.emoji,
    description: row.description,
    starCost: row.starCost,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export function publicRedemption(row: {
  id: string;
  status: string;
  title: string;
  emoji: string;
  description?: string;
  starCost: number;
  starsHeld: number;
  requestedAt: Date;
  resolvedAt: Date | null;
  approvedAt?: Date | null;
  deniedAt?: Date | null;
  redeemedAt?: Date | null;
  skuId: string;
  playerId: string;
  player?: { id: string; name: string; mascot: string };
  sku?: { slug: string };
}) {
  const status = row.status.toLowerCase();
  return {
    id: row.id,
    skuId: row.skuId,
    slug: row.sku?.slug ?? "",
    status: (status === "fulfilled" ? "owned" : status) as "pending" | "owned" | "redeemed" | "denied",
    title: row.title,
    emoji: row.emoji,
    description: row.description ?? "",
    starCost: row.starCost,
    starsHeld: row.starsHeld,
    requestedAt: row.requestedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    deniedAt: row.deniedAt?.toISOString() ?? null,
    redeemedAt: row.redeemedAt?.toISOString() ?? null,
    player: row.player
      ? { id: row.player.id, name: row.player.name, mascot: row.player.mascot }
      : { id: row.playerId, name: "", mascot: "" },
  };
}

export async function listActiveCatalog() {
  const rows = await prisma.storeSku.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(publicSku);
}

export async function listParentSkus() {
  const rows = await prisma.storeSku.findMany({
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(publicSku);
}

async function listRewards(playerId: string, status: "PENDING" | "OWNED" | "REDEEMED" | "DENIED") {
  const rows = await prisma.storeRedemption.findMany({
    where: { playerId, status },
    include: redemptionInclude,
    orderBy: status === "PENDING" ? { requestedAt: "desc" } : { resolvedAt: "desc" },
  });
  return rows.map(publicRedemption);
}

export async function playerStore(playerId: string) {
  const [catalog, wallet, pending, owned] = await Promise.all([
    listActiveCatalog(),
    playerWallet(playerId),
    listRewards(playerId, "PENDING"),
    listRewards(playerId, "OWNED"),
  ]);
  return {
    ...publicWallet(wallet),
    catalog: catalog.map((sku) => ({
      ...sku,
      affordable: canAfford(wallet.currentStars, wallet.heldStars, sku.starCost),
    })),
    pending,
    owned,
  };
}

export async function playerRewardHistory(playerId: string) {
  const [pending, owned, redeemed, denied] = await Promise.all([
    listRewards(playerId, "PENDING"),
    listRewards(playerId, "OWNED"),
    listRewards(playerId, "REDEEMED"),
    listRewards(playerId, "DENIED"),
  ]);
  return { pending, owned, redeemed, denied };
}

export async function listPendingRedemptions() {
  const rows = await prisma.storeRedemption.findMany({
    where: { status: "PENDING" },
    include: redemptionInclude,
    orderBy: { requestedAt: "asc" },
  });
  return rows.map(publicRedemption);
}

export async function listOwnedRedemptions() {
  const rows = await prisma.storeRedemption.findMany({
    where: { status: "OWNED" },
    include: redemptionInclude,
    orderBy: { approvedAt: "asc" },
  });
  return rows.map(publicRedemption);
}

export async function listAllRedemptions() {
  const rows = await prisma.storeRedemption.findMany({
    include: redemptionInclude,
    orderBy: { requestedAt: "desc" },
  });
  return rows.map(publicRedemption);
}

export async function parentKidsOverview() {
  const players = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, mascot: true },
  });
  return Promise.all(
    players.map(async (kid) => ({
      ...kid,
      wallet: publicWallet(await playerWallet(kid.id)),
      rewards: await playerRewardHistory(kid.id),
    })),
  );
}

export async function parentStorePayload() {
  const kids = await parentKidsOverview();
  const pending = await listPendingRedemptions();
  return {
    redemptions: pending,
    pending,
    owned: await listOwnedRedemptions(),
    history: await listAllRedemptions(),
    skus: await listParentSkus(),
    kids,
  };
}

export async function requestStoreSku(playerId: string, skuId: string) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const sku = await tx.storeSku.findUnique({ where: { id: skuId } });
      if (!sku || !sku.isActive) throw httpError("That reward isn't on the shelf right now.");
      if (sku.starCost < 1) throw httpError("That reward isn't priced yet.");
      const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      const held = await starsHeldForPlayer(playerId, tx);
      if (!canAfford(player.points, held, sku.starCost)) {
        throw httpError("Not enough stars yet. Harvest plants to earn more.");
      }
      const row = await tx.storeRedemption.create({
        data: {
          playerId,
          skuId: sku.id,
          status: "PENDING",
          title: sku.title,
          emoji: sku.emoji,
          description: sku.description,
          starCost: sku.starCost,
          starsHeld: sku.starCost,
        },
        include: redemptionInclude,
      });
      await appendStarEvent(tx, {
        playerId,
        kind: "HOLD_REWARD",
        amount: sku.starCost,
        idempotencyKey: `hold:${row.id}`,
        redemptionId: row.id,
        source: "store_request",
        meta: { slug: sku.slug },
      });
      await appendRewardEvent(tx, {
        redemptionId: row.id,
        fromStatus: null,
        toStatus: "PENDING",
        note: "requested",
      });
      await tx.activityLog.create({
        data: {
          playerId,
          action: "store_request",
          details: { skuId: sku.id, slug: sku.slug, starsHeld: sku.starCost, redemptionId: row.id },
        },
      });
      return { redemption: row, playerName: player.name, skuTitle: sku.title };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );
}

export async function approveRedemption(redemptionId: string, adminId: string) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const row = await tx.storeRedemption.findUnique({
        where: { id: redemptionId },
        include: { sku: true, player: true },
      });
      if (!row) throw httpError("That store request is gone.", 404);
      if (row.status !== "PENDING") throw httpError("A grown-up already handled that one.");
      const now = new Date();
      const nextPoints = spendHeldStars(row.player.points, row.starsHeld);
      await tx.player.update({ where: { id: row.playerId }, data: { points: nextPoints } });
      await appendStarEvent(tx, {
        playerId: row.playerId,
        kind: "SPEND_REWARD",
        amount: row.starsHeld,
        idempotencyKey: `spend:${row.id}`,
        redemptionId: row.id,
        source: "store_approve",
        meta: { slug: row.sku.slug },
      });
      const updated = await tx.storeRedemption.update({
        where: { id: row.id },
        data: {
          status: "OWNED",
          resolvedAt: now,
          approvedAt: now,
          resolvedByAdminId: adminId,
          starsHeld: 0,
        },
        include: redemptionInclude,
      });
      await appendRewardEvent(tx, {
        redemptionId: row.id,
        fromStatus: "PENDING",
        toStatus: "OWNED",
        adminId,
        note: "approved",
      });
      await tx.activityLog.create({
        data: {
          playerId: row.playerId,
          action: "store_approve",
          details: { redemptionId: row.id, slug: row.sku.slug, stars: row.starCost },
        },
      });
      await tx.auditLog.create({
        data: {
          adminId,
          targetPlayerId: row.playerId,
          action: "store_approve",
          details: { redemptionId: row.id, title: row.title, stars: row.starCost },
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );
}

/** Old name: fulfill meant parent approval, now OWNED. */
export async function fulfillRedemption(redemptionId: string, adminId: string) {
  return approveRedemption(redemptionId, adminId);
}

export async function denyRedemption(redemptionId: string, adminId: string, reason = "") {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const row = await tx.storeRedemption.findUnique({
        where: { id: redemptionId },
        include: { sku: true, player: true },
      });
      if (!row) throw httpError("That store request is gone.", 404);
      if (row.status !== "PENDING") throw httpError("A grown-up already handled that one.");
      const now = new Date();
      await appendStarEvent(tx, {
        playerId: row.playerId,
        kind: "RELEASE_REWARD",
        amount: row.starsHeld,
        idempotencyKey: `release:${row.id}`,
        redemptionId: row.id,
        source: "store_deny",
      });
      const updated = await tx.storeRedemption.update({
        where: { id: row.id },
        data: {
          status: "DENIED",
          resolvedAt: now,
          deniedAt: now,
          denyReason: reason,
          resolvedByAdminId: adminId,
          starsHeld: 0,
        },
        include: redemptionInclude,
      });
      await appendRewardEvent(tx, {
        redemptionId: row.id,
        fromStatus: "PENDING",
        toStatus: "DENIED",
        adminId,
        note: reason || "denied",
      });
      await tx.activityLog.create({
        data: {
          playerId: row.playerId,
          action: "store_deny",
          details: { redemptionId: row.id, slug: row.sku.slug, stars: row.starCost },
        },
      });
      await tx.auditLog.create({
        data: {
          adminId,
          targetPlayerId: row.playerId,
          action: "store_deny",
          details: { redemptionId: row.id, title: row.title, stars: row.starCost },
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );
}

export async function redeemRedemption(redemptionId: string, adminId: string) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const row = await tx.storeRedemption.findUnique({
        where: { id: redemptionId },
        include: { sku: true, player: true },
      });
      if (!row) throw httpError("That reward is gone.", 404);
      if (row.status === "REDEEMED") throw httpError("A grown-up already marked that one used.");
      if (row.status !== "OWNED") throw httpError("Only an owned reward can be marked used.");
      const now = new Date();
      const updated = await tx.storeRedemption.update({
        where: { id: row.id },
        data: {
          status: "REDEEMED",
          redeemedAt: now,
          redeemedByAdminId: adminId,
        },
        include: redemptionInclude,
      });
      await appendRewardEvent(tx, {
        redemptionId: row.id,
        fromStatus: "OWNED",
        toStatus: "REDEEMED",
        adminId,
        note: "redeemed",
      });
      await tx.activityLog.create({
        data: {
          playerId: row.playerId,
          action: "store_redeem",
          details: { redemptionId: row.id, slug: row.sku.slug, stars: row.starCost },
        },
      });
      await tx.auditLog.create({
        data: {
          adminId,
          targetPlayerId: row.playerId,
          action: "store_redeem",
          details: { redemptionId: row.id, title: row.title, stars: row.starCost },
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );
}

export async function grantEarnedStars(playerId: string, amount: number, reason: string) {
  if (!Number.isInteger(amount) || amount < 1) throw httpError("Grant a whole number of stars.");
  const key = `grant:${playerId}:${Date.now()}:${amount}`;
  return prisma.$transaction(async (tx) => {
    await tx.player.update({ where: { id: playerId }, data: { points: { increment: amount } } });
    await appendStarEvent(tx, {
      playerId,
      kind: "EARN_GRANT",
      amount,
      idempotencyKey: key,
      source: "admin_grant",
      meta: { reason },
    });
    return playerWallet(playerId, tx);
  });
}

export async function backfillStarLedgers() {
  const players = await prisma.player.findMany({
    include: { storeRedemptions: { include: { sku: true } } },
  });
  for (const player of players) {
    const existing = await prisma.starLedgerEvent.count({ where: { playerId: player.id } });
    if (existing > 0) continue;
    const harvests = await prisma.activityLog.findMany({
      where: { playerId: player.id, action: "harvest" },
      orderBy: { createdAt: "asc" },
    });
    await prisma.$transaction(async (tx) => {
      let harvestTotal = 0;
      for (const log of harvests) {
        const pts = Number((log.details as { points?: number } | null)?.points ?? 0);
        if (pts < 1) continue;
        harvestTotal += pts;
        await appendStarEvent(tx, {
          playerId: player.id,
          kind: "EARN_HARVEST",
          amount: pts,
          idempotencyKey: `earn:harvest:${log.id}`,
          source: "backfill:harvest",
          meta: { activityId: log.id },
        });
      }
      let spent = 0;
      for (const row of player.storeRedemptions) {
        const status = row.status;
        if (status === "PENDING") {
          await appendStarEvent(tx, {
            playerId: player.id,
            kind: "HOLD_REWARD",
            amount: row.starsHeld || row.starCost,
            idempotencyKey: `hold:${row.id}`,
            redemptionId: row.id,
            source: "backfill",
          });
          await appendRewardEvent(tx, {
            redemptionId: row.id,
            fromStatus: null,
            toStatus: "PENDING",
            note: "backfill",
          });
        } else if (status === "DENIED") {
          await appendStarEvent(tx, {
            playerId: player.id,
            kind: "HOLD_REWARD",
            amount: row.starCost,
            idempotencyKey: `hold:${row.id}`,
            redemptionId: row.id,
            source: "backfill",
          });
          await appendStarEvent(tx, {
            playerId: player.id,
            kind: "RELEASE_REWARD",
            amount: row.starCost,
            idempotencyKey: `release:${row.id}`,
            redemptionId: row.id,
            source: "backfill",
          });
          await appendRewardEvent(tx, {
            redemptionId: row.id,
            fromStatus: "PENDING",
            toStatus: "DENIED",
            note: "backfill",
          });
        } else if (status === "OWNED" || status === "REDEEMED") {
          spent += row.starCost;
          await appendStarEvent(tx, {
            playerId: player.id,
            kind: "SPEND_REWARD",
            amount: row.starCost,
            idempotencyKey: `spend:${row.id}`,
            redemptionId: row.id,
            source: "backfill",
          });
          await appendRewardEvent(tx, {
            redemptionId: row.id,
            fromStatus: "PENDING",
            toStatus: "OWNED",
            note: "backfill",
          });
          if (status === "REDEEMED") {
            await appendRewardEvent(tx, {
              redemptionId: row.id,
              fromStatus: "OWNED",
              toStatus: "REDEEMED",
              note: "backfill",
            });
          }
        }
      }
      const opening = player.points + spent - harvestTotal;
      if (opening > 0) {
        await appendStarEvent(tx, {
          playerId: player.id,
          kind: "OPENING_BALANCE",
          amount: opening,
          idempotencyKey: `opening:${player.id}`,
          source: "backfill:legacy-opening",
          meta: {
            note: "Unknown provenance before the star ledger. Not a dated harvest.",
            points: player.points,
            reconstructedHarvests: harvestTotal,
            reconstructedSpend: spent,
          },
        });
      } else if (opening < 0) {
        await appendStarEvent(tx, {
          playerId: player.id,
          kind: "ADJUST_ADMIN",
          amount: opening,
          idempotencyKey: `reconcile:${player.id}`,
          source: "backfill:reconcile",
          meta: { points: player.points, reconstructedHarvests: harvestTotal, reconstructedSpend: spent },
        });
      }
    });
  }
}
