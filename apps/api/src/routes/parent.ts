import type { FastifyInstance } from "fastify";
import { getAdminSession, requireAdmin } from "../auth.js";
import { prisma } from "../db.js";
import { approveClaim, denyClaim, listParentInbox } from "../chores.js";
import { loadConfig, publicPlayer } from "../game.js";
import {
  actorFromActionToken,
  adminHasPushSubscription,
  deletePushSubscription,
  notifyChoreClaimResolved,
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
    const chores = await prisma.chore.findMany({ orderBy: { sortOrder: "asc" } });
    return {
      chores: chores.map((chore) => ({
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
        legacyPoints: chore.legacyPoints,
        assignmentMode: chore.assignmentMode,
        sortOrder: chore.sortOrder,
      })),
    };
  });

  app.get("/api/parent/inbox", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return { claims: await listParentInbox() };
  });

  app.post("/api/parent/claims/:id/approve", async (request, reply) => {
    const { id } = request.params as { id: string };
    const actor = await requireParentActor(request, reply, { kind: "chore_claim", subjectId: id });
    if (!actor) return;
    try {
      await approveClaim(id, actor.adminId);
      void notifyChoreClaimResolved(id).catch((err) => app.log.warn({ err }, "push clear failed"));
      return { ok: true, status: "APPROVED", claims: await listParentInbox() };
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
      return { ok: true, status: "DENIED", claims: await listParentInbox() };
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
}
