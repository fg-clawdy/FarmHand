import type { FastifyInstance } from "fastify";
import { requirePlayer } from "../auth.js";
import { requireAdmin } from "../auth.js";
import {
  activeSharedGoals,
  getSharedGoal,
  pourSharedGoal,
  putBackSharedGoal,
  createSharedGoal,
  openSharedGoal,
  removeWaitingGoal,
  happenSharedGoal,
  cancelSharedGoal,
  patchSharedGoal,
  parentSharedGoals,
  markFamilyJarCoachSeen,
  patchPlayerGiving,
  updateSharedGoalArt,
  regenerateSharedGoalArt,
} from "../sharedGoals.js";
import { notifySharedGoalReady } from "../push.js";

export async function sharedGoalRoutes(app: FastifyInstance) {
  // ---- Kid / farm routes ----

  app.get("/api/shared-goal/active", async () => {
    const familyJars = await activeSharedGoals();
    return { familyJar: familyJars[0] ?? null, familyJars };
  });

  app.get("/api/shared-goal/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const jar = await getSharedGoal(id);
    if (!jar) return reply.code(404).send({ error: "That jar isn't here." });
    return { familyJar: jar };
  });

  app.post("/api/shared-goal/give", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const body = (request.body ?? {}) as {
      goalId?: string;
      amount?: number;
      requestId?: string;
    };
    try {
      const result = await pourSharedGoal({
        playerId: session.playerId,
        goalId: String(body.goalId ?? ""),
        amount: Number(body.amount ?? 0),
        requestId: String(body.requestId ?? ""),
      });
      if (result.status === "READY") {
        void notifySharedGoalReady(String(body.goalId ?? ""), result.title).catch((err: unknown) =>
          app.log.warn({ err }, "shared goal ready push failed"),
        );
      }
      return result;
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/shared-goal/put-back", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const body = (request.body ?? {}) as {
      goalId?: string;
      giveKey?: string;
    };
    try {
      return await putBackSharedGoal({
        playerId: session.playerId,
        goalId: String(body.goalId ?? ""),
        giveKey: String(body.giveKey ?? ""),
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/shared-goal/coach-seen", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    return markFamilyJarCoachSeen(session.playerId);
  });

  // ---- Parent routes ----

  app.get("/api/parent/shared-goal", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return parentSharedGoals();
  });

  app.post("/api/parent/shared-goal", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = (request.body ?? {}) as {
      title?: string;
      emoji?: string;
      targetStars?: number;
      artNotes?: string;
      generateArt?: boolean;
      queue?: boolean;
    };
    try {
      return await createSharedGoal({
        title: String(body.title ?? ""),
        emoji: String(body.emoji ?? ""),
        targetStars: Number(body.targetStars ?? 0),
        artNotes: body.artNotes,
        generateArt: body.generateArt === true,
        queue: body.queue === true,
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });



  app.post("/api/parent/shared-goal/:id/open", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      const goal = await openSharedGoal(id);
      return { goal };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.delete("/api/parent/shared-goal/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      return await removeWaitingGoal(id);
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.patch("/api/parent/shared-goal/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      title?: string;
      emoji?: string;
      targetStars?: number;
      sortOrder?: number;
    };
    try {
      const goal = await patchSharedGoal(id, {
        title: body.title,
        emoji: body.emoji,
        targetStars: body.targetStars !== undefined ? Number(body.targetStars) : undefined,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
      });
      return { goal };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.patch("/api/parent/shared-goal/:id/art", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      artPrompt?: string;
      artNotes?: string;
      regenerate?: boolean;
    };
    try {
      return await updateSharedGoalArt(id, {
        artPrompt: body.artPrompt,
        artNotes: body.artNotes,
        regenerate: body.regenerate === true,
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/shared-goal/:id/art/regenerate", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      return await regenerateSharedGoalArt(id);
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/shared-goal/:id/happen", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      const goal = await happenSharedGoal(id);
      return { goal };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/parent/shared-goal/:id/cancel", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    try {
      const goal = await cancelSharedGoal(id);
      return { goal };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.patch("/api/parent/players/:id/giving", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      givingEnabled?: boolean;
      giveCeiling?: number;
    };
    try {
      return await patchPlayerGiving(id, {
        givingEnabled: body.givingEnabled,
        giveCeiling: body.giveCeiling !== undefined ? Number(body.giveCeiling) : undefined,
      });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });
}
