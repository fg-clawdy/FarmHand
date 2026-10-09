import type { FastifyInstance, FastifyReply } from "fastify";
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
import { verifySecret } from "../auth.js";
import {
  DONATE_PLAYER_MISMATCH,
  DONATE_PLAYER_REQUIRED,
  authorizeDonatePin,
  donatePlayerMatchesSession,
  explicitDonatePlayerId,
} from "../donatePlayer.js";

/** Body must name the donor before we look at the session cookie. No default child. */
function explicitDonor(body: { playerId?: unknown }, reply: FastifyReply) {
  const playerId = explicitDonatePlayerId(body.playerId);
  if (!playerId) {
    reply.code(400).send({ error: DONATE_PLAYER_REQUIRED });
    return null;
  }
  return playerId;
}

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
    const body = (request.body ?? {}) as {
      playerId?: unknown;
      goalId?: string;
      amount?: number;
      requestId?: string;
      pin?: unknown;
    };
    const playerId = explicitDonor(body, reply);
    if (!playerId) return;
    const session = await requirePlayer(request, reply);
    if (!session) return;
    if (!donatePlayerMatchesSession(playerId, session.playerId)) {
      return reply.code(403).send({ error: DONATE_PLAYER_MISMATCH });
    }
    const pinOk = await authorizeDonatePin({
      hasPin: Boolean(session.player.pinHash),
      pin: body.pin,
      verifyPin: (pin) => verifySecret(pin, session.player.pinHash ?? ""),
    });
    if (!pinOk.ok) return reply.code(pinOk.statusCode).send({ error: pinOk.error });
    try {
      const result = await pourSharedGoal({
        playerId,
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
    const body = (request.body ?? {}) as {
      playerId?: unknown;
      goalId?: string;
      giveKey?: string;
    };
    const playerId = explicitDonor(body, reply);
    if (!playerId) return;
    const session = await requirePlayer(request, reply);
    if (!session) return;
    if (!donatePlayerMatchesSession(playerId, session.playerId)) {
      return reply.code(403).send({ error: DONATE_PLAYER_MISMATCH });
    }
    try {
      return await putBackSharedGoal({
        playerId,
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
      targetPoints?: number;
      artNotes?: string;
      generateArt?: boolean;
      queue?: boolean;
    };
    try {
      return await createSharedGoal({
        title: String(body.title ?? ""),
        emoji: String(body.emoji ?? ""),
        targetPoints: Number(body.targetPoints ?? 0),
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
      targetPoints?: number;
      sortOrder?: number;
    };
    try {
      const goal = await patchSharedGoal(id, {
        title: body.title,
        emoji: body.emoji,
        targetPoints: body.targetPoints !== undefined ? Number(body.targetPoints) : undefined,
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
