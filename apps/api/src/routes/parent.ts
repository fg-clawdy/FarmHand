import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../auth.js";
import { prisma } from "../db.js";
import { approveClaim, denyClaim, listParentInbox } from "../chores.js";
import { loadConfig, publicPlayer } from "../game.js";

export async function parentRoutes(app: FastifyInstance) {
  app.get("/api/parent/me", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return { admin: { id: session.admin.id, username: session.admin.username } };
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
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      await approveClaim(id, session.admin.id);
      return { ok: true, claims: await listParentInbox() };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/claims/:id/deny", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      await denyClaim(id, session.admin.id);
      return { ok: true, claims: await listParentInbox() };
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
