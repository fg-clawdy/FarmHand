import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import type { FastifyInstance } from "fastify";
import { getAdminSession, requireAdmin } from "../auth.js";
import { prisma } from "../db.js";
import { approveClaim, denyClaim, listParentInbox } from "../chores.js";
import { loadConfig, publicPlayer } from "../game.js";
import {
  createParentChore,
  getParentChore,
  listParentChores,
  listParentKids,
  updateParentChore,
} from "../parentChores.js";
import type { ParentChoreBody } from "../parentChoreWrite.js";
import type { ParentSkuBody } from "../parentStoreWrite.js";
import { buildParentStats, parseParentStatsRange, statsLookbackStart } from "../parentStats.js";
import { farmAccoladeLedgers } from "../accolades.js";
import {
  approveRedemption,
  denyRedemption,
  fulfillRedemption,
  listPendingRedemptions,
  parentKidsOverview,
  parentStorePayload,
  publicSku,
  redeemRedemption,
} from "../store.js";
import { parseSkuCreate, parseSkuPatch } from "../parentStoreWrite.js";
import {
  actorFromActionToken,
  adminHasPushSubscription,
  deletePushSubscription,
  notifyChoreClaimResolved,
  notifyStoreRedemptionResolved,
  upsertPushSubscription,
  vapidConfig,
  type ApprovalKind,
} from "../push.js";

async function requireParentActor(
  request: Parameters<typeof getAdminSession>[0],
  reply: Parameters<typeof requireAdmin>[1],
  opts: { kind: ApprovalKind; subjectId: string },
) {
  const session = await getAdminSession(request);
  if (session) return { adminId: session.admin.id, via: "session" as const };
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    reply.code(401).send({ error: "Admin login required." });
    return null;
  }
  const actor = await actorFromActionToken(token, opts.kind, opts.subjectId);
  if (!actor) {
    reply.code(401).send({ error: "That notification is stale. Open the inbox." });
    return null;
  }
  return { adminId: actor.adminId, via: "action-token" as const };
}

export async function parentRoutes(app: FastifyInstance) {
  app.get("/api/parent/me", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return { admin: { id: session.admin.id, username: session.admin.username } };
  });

  app.get("/api/parent/push/config", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const vapid = vapidConfig();
    return {
      enabled: vapid.enabled,
      publicKey: vapid.enabled ? vapid.publicKey : null,
      subscribed: await adminHasPushSubscription(session.admin.id),
    };
  });

  app.post("/api/parent/push/subscribe", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = (request.body ?? {}) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    try {
      const row = await upsertPushSubscription({
        adminId: session.admin.id,
        endpoint: String(body.endpoint ?? ""),
        p256dh: String(body.keys?.p256dh ?? ""),
        auth: String(body.keys?.auth ?? ""),
        userAgent: String(request.headers["user-agent"] ?? ""),
      });
      return { ok: true, id: row.id, subscribed: true };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.delete("/api/parent/push/subscribe", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = (request.body ?? {}) as { endpoint?: string };
    if (!body.endpoint) return reply.code(400).send({ error: "Missing push endpoint." });
    await deletePushSubscription(session.admin.id, body.endpoint);
    return { ok: true, subscribed: false };
  });

  app.post("/api/parent/push/unsubscribe", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = (request.body ?? {}) as { endpoint?: string };
    if (!body.endpoint) return reply.code(400).send({ error: "Missing push endpoint." });
    await deletePushSubscription(session.admin.id, body.endpoint);
    return { ok: true, subscribed: false };
  });

  app.get("/api/parent/chores", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return { chores: await listParentChores() };
  });

  app.get("/api/parent/chores/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      return { chore: await getParentChore(id) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/chores", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    try {
      const chore = await createParentChore((request.body ?? {}) as ParentChoreBody);
      return reply.code(201).send({ chore });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.patch("/api/parent/chores/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      return { chore: await updateParentChore(id, (request.body ?? {}) as ParentChoreBody) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.get("/api/parent/kids", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return { kids: await parentKidsOverview() };
  });

  app.get("/api/parent/accolades", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const config = await loadConfig();
    return farmAccoladeLedgers(config.timezone);
  });

  app.get("/api/parent/stats", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    try {
      const query = request.query as { range?: unknown };
      const range = parseParentStatsRange(query.range);
      const config = await loadConfig();
      const now = new Date();
      const kids = await listParentKids();
      const rows = await prisma.choreClaim.findMany({
        where: { claimedAt: { gte: statsLookbackStart(config.timezone, now) } },
        include: { chore: true },
        orderBy: { claimedAt: "asc" },
      });
      return buildParentStats({
        kids,
        range,
        timezone: config.timezone,
        now,
        claims: rows.map((row) => ({
          playerId: row.playerId,
          choreId: row.choreId,
          choreTitle: row.chore.title,
          choreEmoji: row.chore.emoji,
          status: row.status,
          claimedAt: row.claimedAt,
          resolvedAt: row.resolvedAt,
        })),
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.get("/api/parent/inbox", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return { claims: await listParentInbox(), redemptions: await listPendingRedemptions() };
  });

  app.post("/api/parent/claims/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await requireParentActor(request, reply, { kind: "chore_claim", subjectId: id });
    if (!actor) return;
    try {
      await approveClaim(id, actor.adminId);
      void notifyChoreClaimResolved(id).catch((err) => app.log.warn({ err }, "push clear failed"));
      return { ok: true, status: "APPROVED", claims: await listParentInbox(), redemptions: await listPendingRedemptions() };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/claims/:id/deny", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await requireParentActor(request, reply, { kind: "chore_claim", subjectId: id });
    if (!actor) return;
    try {
      await denyClaim(id, actor.adminId);
      void notifyChoreClaimResolved(id).catch((err) => app.log.warn({ err }, "push clear failed"));
      return { ok: true, status: "DENIED", claims: await listParentInbox(), redemptions: await listPendingRedemptions() };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.get("/api/parent/claims/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const config = await loadConfig();
    const claim = await prisma.choreClaim.findUnique({
      where: { id },
      include: { chore: true, player: { include: { plots: { orderBy: { slot: "asc" } } } }, plot: true },
    });
    if (!claim) return reply.code(404).send({ error: "That claim is gone." });
    return {
      claim: {
        id: claim.id,
        status: claim.status,
        slot: claim.slot,
        plantTier: claim.plantTier,
        periodKey: claim.periodKey,
        claimedAt: claim.claimedAt,
        resolvedAt: claim.resolvedAt,
        hasPhoto: Boolean(claim.proofJpegPath),
        chore: {
          id: claim.chore.id,
          slug: claim.chore.slug,
          title: claim.chore.title,
          emoji: claim.chore.emoji,
          priority: claim.chore.priority,
        },
        player: publicPlayer(claim.player, config, false),
      },
    };
  });

  app.get("/api/parent/claims/:id/photo", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const claim = await prisma.choreClaim.findUnique({ where: { id } });
    if (!claim?.proofJpegPath) return reply.code(404).send({ error: "That photo isn't here." });
    try {
      await access(claim.proofJpegPath, fsConstants.R_OK);
    } catch {
      return reply.code(404).send({ error: "That photo isn't here." });
    }
    reply.header("Content-Type", "image/jpeg");
    reply.header("Cache-Control", "private, max-age=120");
    return reply.send(createReadStream(claim.proofJpegPath));
  });

  app.get("/api/parent/store", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return parentStorePayload();
  });

  app.post("/api/parent/store/skus", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    try {
      const data = parseSkuCreate((request.body ?? {}) as ParentSkuBody);
      let slug = data.slug;
      let n = 2;
      while (await prisma.storeSku.findUnique({ where: { slug } })) {
        slug = `${data.slug}-${n}`;
        n += 1;
      }
      const row = await prisma.storeSku.create({ data: { ...data, slug } });
      return { sku: publicSku(row) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.patch("/api/parent/store/skus/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      const existing = await prisma.storeSku.findUnique({ where: { id } });
      if (!existing) return reply.code(404).send({ error: "That reward isn't on the list." });
      const patch = parseSkuPatch((request.body ?? {}) as ParentSkuBody);
      const row = await prisma.storeSku.update({ where: { id }, data: patch });
      return { sku: publicSku(row) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/redemptions/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await requireParentActor(request, reply, { kind: "store_redemption", subjectId: id });
    if (!actor) return;
    try {
      await approveRedemption(id, actor.adminId);
      void notifyStoreRedemptionResolved(id).catch((err) => app.log.warn({ err }, "store push clear failed"));
      return {
        ok: true,
        status: "OWNED",
        redemptions: await listPendingRedemptions(),
        claims: await listParentInbox(),
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/redemptions/:id/fulfill", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await requireParentActor(request, reply, { kind: "store_redemption", subjectId: id });
    if (!actor) return;
    try {
      await fulfillRedemption(id, actor.adminId);
      void notifyStoreRedemptionResolved(id).catch((err) => app.log.warn({ err }, "store push clear failed"));
      return {
        ok: true,
        status: "OWNED",
        redemptions: await listPendingRedemptions(),
        claims: await listParentInbox(),
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/redemptions/:id/deny", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await requireParentActor(request, reply, { kind: "store_redemption", subjectId: id });
    if (!actor) return;
    try {
      await denyRedemption(id, actor.adminId);
      void notifyStoreRedemptionResolved(id).catch((err) => app.log.warn({ err }, "store push clear failed"));
      return {
        ok: true,
        status: "DENIED",
        redemptions: await listPendingRedemptions(),
        claims: await listParentInbox(),
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/redemptions/:id/redeem", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      await redeemRedemption(id, session.adminId);
      return {
        ok: true,
        status: "REDEEMED",
        redemptions: await listPendingRedemptions(),
        claims: await listParentInbox(),
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });
}
