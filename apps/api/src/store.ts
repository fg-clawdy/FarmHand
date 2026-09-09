import { STARTER_STORE_CATALOG, availableStars, canAfford, spendHeldStars } from "@farmhand/shared";
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { httpError } from "./chores.js";

type Tx = Prisma.TransactionClient;

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
  starCost: number;
  starsHeld: number;
  requestedAt: Date;
  resolvedAt: Date | null;
  skuId: string;
  playerId: string;
  player?: { id: string; name: string; mascot: string };
  sku?: { slug: string };
}) {
  return {
    id: row.id,
    skuId: row.skuId,
    slug: row.sku?.slug ?? "",
    status: row.status.toLowerCase() as "pending" | "fulfilled" | "denied",
    title: row.title,
    emoji: row.emoji,
    starCost: row.starCost,
    starsHeld: row.starsHeld,
    requestedAt: row.requestedAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    player: row.player
      ? { id: row.player.id, name: row.player.name, mascot: row.player.mascot }
      : { id: row.playerId, name: "", mascot: "" },
  };
}

export async function starsHeldForPlayer(playerId: string, tx: Tx | typeof prisma = prisma) {
  const agg = await tx.storeRedemption.aggregate({
    where: { playerId, status: "PENDING" },
    _sum: { starsHeld: true },
  });
  return agg._sum.starsHeld ?? 0;
}

export async function playerStarLedger(playerId: string, tx: Tx | typeof prisma = prisma) {
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId }, select: { points: true } });
  const held = await starsHeldForPlayer(playerId, tx);
  return {
    points: player.points,
    starsHeld: held,
    availableStars: availableStars(player.points, held),
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

export async function playerStore(playerId: string) {
  const [catalog, ledger, pending, recent] = await Promise.all([
    listActiveCatalog(),
    playerStarLedger(playerId),
    prisma.storeRedemption.findMany({
      where: { playerId, status: "PENDING" },
      include: { sku: true, player: { select: { id: true, name: true, mascot: true } } },
      orderBy: { requestedAt: "desc" },
    }),
    prisma.storeRedemption.findMany({
      where: { playerId, status: { in: ["FULFILLED", "DENIED"] } },
      include: { sku: true, player: { select: { id: true, name: true, mascot: true } } },
      orderBy: { resolvedAt: "desc" },
      take: 8,
    }),
  ]);
  return {
    ...ledger,
    catalog: catalog.map((sku) => ({
      ...sku,
      affordable: canAfford(ledger.points, ledger.starsHeld, sku.starCost),
    })),
    pending: pending.map(publicRedemption),
    recent: recent.map(publicRedemption),
  };
}

export async function listPendingRedemptions() {
  const rows = await prisma.storeRedemption.findMany({
    where: { status: "PENDING" },
    include: { sku: true, player: { select: { id: true, name: true, mascot: true } } },
    orderBy: { requestedAt: "asc" },
  });
  return rows.map(publicRedemption);
}

export async function requestStoreSku(playerId: string, skuId: string) {
  return withSerializableRetry(() =>
    prisma.$transaction(
      async (tx) => {
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
          starCost: sku.starCost,
          starsHeld: sku.starCost,
        },
        include: { sku: true, player: { select: { id: true, name: true, mascot: true } } },
      });
      await tx.activityLog.create({
        data: {
          playerId,
          action: "store_request",
          details: { skuId: sku.id, slug: sku.slug, starsHeld: sku.starCost, redemptionId: row.id },
        },
      });
      return { redemption: row, playerName: player.name, skuTitle: sku.title };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
    ),
  );
}

async function resolveRedemption(redemptionId: string, adminId: string, action: "fulfill" | "deny") {
  return withSerializableRetry(() =>
    prisma.$transaction(
    async (tx) => {
      const row = await tx.storeRedemption.findUnique({
        where: { id: redemptionId },
        include: { sku: true, player: true },
      });
      if (!row) throw httpError("That store request is gone.", 404);
      if (row.status !== "PENDING") throw httpError("A grown-up already handled that one.");
      const now = new Date();
      if (action === "fulfill") {
        const nextPoints = spendHeldStars(row.player.points, row.starsHeld);
        await tx.player.update({
          where: { id: row.playerId },
          data: { points: nextPoints },
        });
      }
      const updated = await tx.storeRedemption.update({
        where: { id: row.id },
        data: {
          status: action === "fulfill" ? "FULFILLED" : "DENIED",
          resolvedAt: now,
          resolvedByAdminId: adminId,
          starsHeld: action === "deny" ? 0 : row.starsHeld,
        },
        include: { sku: true, player: { select: { id: true, name: true, mascot: true } } },
      });
      await tx.activityLog.create({
        data: {
          playerId: row.playerId,
          action: action === "fulfill" ? "store_fulfill" : "store_deny",
          details: { redemptionId: row.id, slug: row.sku.slug, stars: row.starCost },
        },
      });
      await tx.auditLog.create({
        data: {
          adminId,
          targetPlayerId: row.playerId,
          action: action === "fulfill" ? "store_fulfill" : "store_deny",
          details: { redemptionId: row.id, title: row.title, stars: row.starCost },
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 },
    ),
  );
}

export async function fulfillRedemption(redemptionId: string, adminId: string) {
  return resolveRedemption(redemptionId, adminId, "fulfill");
}

export async function denyRedemption(redemptionId: string, adminId: string) {
  return resolveRedemption(redemptionId, adminId, "deny");
}
