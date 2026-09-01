import type { FastifyInstance } from "fastify";
import type { Mascot } from "@prisma/client";
import { DEFAULT_GAME_CONFIG, MASCOTS, mergeGameConfig, serializePlot } from "@farmhand/shared";
import { prisma } from "../db.js";
import {
  ADMIN_COOKIE,
  PLAYER_COOKIE,
  cookieOpts,
  hashSecret,
  hashToken,
  newToken,
  requireAdmin,
  verifySecret,
} from "../auth.js";
import { loadConfig, publicPlayer, saveConfig } from "../game.js";
import { chicagoDayKeys, startOfDaysAgo, startOfToday, todayKey } from "../tz.js";

const MASCOT_SET = new Set<string>(MASCOTS);

function isMascot(value: string): value is Mascot {
  return MASCOT_SET.has(value);
}

export async function adminRoutes(app: FastifyInstance) {
  app.post("/api/admin/login", async (request, reply) => {
    const { username, password } = (request.body ?? {}) as { username?: string; password?: string };
    const admin = await prisma.admin.findUnique({ where: { username: String(username ?? "") } });
    if (!admin || !(await verifySecret(String(password ?? ""), admin.passwordHash))) {
      return reply.code(401).send({ error: "Wrong username or password." });
    }
    const token = newToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await prisma.adminSession.create({
      data: { adminId: admin.id, tokenHash: hashToken(token), expiresAt },
    });
    reply.setCookie(ADMIN_COOKIE, token, cookieOpts(12 * 60 * 60));
    reply.clearCookie(PLAYER_COOKIE, { path: "/" });
    return { admin: { id: admin.id, username: admin.username } };
  });

  app.post("/api/admin/logout", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    await prisma.adminSession.delete({ where: { id: session.id } });
    reply.clearCookie(ADMIN_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/admin/me", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return { admin: { id: session.admin.id, username: session.admin.username } };
  });

  app.get("/api/admin/overview", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const config = await loadConfig();
    const now = new Date();
    const dayStart = startOfToday(config.timezone, now);
    const [activeSessions, harvestsToday, wateringsToday, players] = await Promise.all([
      prisma.playerSession.count({ where: { expiresAt: { gt: now } } }),
      prisma.activityLog.count({ where: { action: "harvest", createdAt: { gte: dayStart } } }),
      prisma.activityLog.count({ where: { action: "watering", createdAt: { gte: dayStart } } }),
      prisma.player.findMany({ include: { plots: true } }),
    ]);
    const readyPlants = players.reduce((sum, player) => {
      return (
        sum +
        player.plots.filter((plot) => serializePlot(plot, config, now).ready).length
      );
    }, 0);
    return {
      activeSessions,
      harvestsToday,
      wateringsToday,
      readyPlants,
      playerCount: players.filter((p) => p.isActive).length,
    };
  });

  app.get("/api/admin/players", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const config = await loadConfig();
    const players = await prisma.player.findMany({
      include: { plots: { orderBy: { slot: "asc" } }, sessions: true },
      orderBy: { createdAt: "asc" },
    });
    const now = new Date();
    return {
      players: players.map((player) => ({
        ...publicPlayer(player, config, false),
        activeSessions: player.sessions.filter((s) => s.expiresAt > now).length,
      })),
    };
  });

  app.get("/api/admin/players/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const config = await loadConfig();
    const player = await prisma.player.findUnique({
      where: { id },
      include: { plots: { orderBy: { slot: "asc" } }, sessions: true },
    });
    if (!player) return reply.code(404).send({ error: "Player not found." });
    const now = new Date();
    return {
      player: {
        ...publicPlayer(player, config, false),
        activeSessions: player.sessions.filter((s) => s.expiresAt > now).length,
      },
    };
  });

  app.post("/api/admin/players", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = (request.body ?? {}) as {
      name?: string;
      mascot?: string;
      pin?: string;
      seeds?: number;
      points?: number;
      fertilizer?: number;
    };
    const name = String(body.name ?? "").trim();
    if (!name) return reply.code(400).send({ error: "Name is required." });
    if (!body.mascot || !isMascot(body.mascot)) {
      return reply.code(400).send({ error: "Pick a mascot." });
    }
    const config = await loadConfig();
    const player = await prisma.player.create({
      data: {
        name,
        mascot: body.mascot,
        pinHash: body.pin ? await hashSecret(String(body.pin)) : null,
        seeds: body.seeds ?? config.startingSeeds,
        points: body.points ?? config.startingPoints,
        fertilizer: body.fertilizer ?? config.startingFertilizer,
        plots: { create: Array.from({ length: config.plotCount }, (_, slot) => ({ slot })) },
      },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    await prisma.auditLog.create({
      data: {
        adminId: session.adminId,
        targetPlayerId: player.id,
        action: "create_player",
        details: { name, mascot: body.mascot },
      },
    });
    return { player: publicPlayer(player, config, false) };
  });

  app.put("/api/admin/players/:id", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { name?: string; mascot?: string };
    const existing = await prisma.player.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Player not found." });
    if (body.mascot && !isMascot(body.mascot)) {
      return reply.code(400).send({ error: "Pick a mascot." });
    }
    const player = await prisma.player.update({
      where: { id },
      data: {
        name: body.name?.trim() || existing.name,
        mascot: body.mascot && isMascot(body.mascot) ? body.mascot : existing.mascot,
      },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    await prisma.auditLog.create({
      data: {
        adminId: session.adminId,
        targetPlayerId: id,
        action: "edit_player",
        details: { name: player.name, mascot: player.mascot },
      },
    });
    const config = await loadConfig();
    return { player: publicPlayer(player, config, false) };
  });

  app.post("/api/admin/players/:id/reset-pin", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const { pin } = (request.body ?? {}) as { pin?: string | null };
    const existing = await prisma.player.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Player not found." });
    let pinHash: string | null = null;
    if (pin !== null && pin !== undefined && String(pin).length > 0) {
      if (!/^\d{4}$/.test(String(pin))) {
        return reply.code(400).send({ error: "PIN must be 4 digits, or empty to clear." });
      }
      pinHash = await hashSecret(String(pin));
    }
    await prisma.player.update({ where: { id }, data: { pinHash } });
    await prisma.playerSession.deleteMany({ where: { playerId: id } });
    await prisma.auditLog.create({
      data: {
        adminId: session.adminId,
        targetPlayerId: id,
        action: "reset_pin",
        details: { cleared: pinHash === null },
      },
    });
    return { ok: true, hasPin: pinHash !== null };
  });

  app.post("/api/admin/players/:id/resources", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      seeds?: number;
      points?: number;
      fertilizer?: number;
      moonDew?: number;
      growGoo?: number;
      phoenixAsh?: number;
      reason?: string;
    };
    const existing = await prisma.player.findUnique({
      where: { id },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    if (!existing) return reply.code(404).send({ error: "Player not found." });
    const clamp = (n: number | undefined, fallback: number) =>
      Math.max(0, Math.floor(n ?? fallback));
    const player = await prisma.player.update({
      where: { id },
      data: {
        seeds: clamp(body.seeds, existing.seeds),
        points: clamp(body.points, existing.points),
        fertilizer: clamp(body.fertilizer, existing.fertilizer),
        moonDew: clamp(body.moonDew, existing.moonDew),
        growGoo: clamp(body.growGoo, existing.growGoo),
        phoenixAsh: clamp(body.phoenixAsh, existing.phoenixAsh),
      },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    await prisma.auditLog.create({
      data: {
        adminId: session.adminId,
        targetPlayerId: id,
        action: "adjust_resources",
        details: {
          before: {
            seeds: existing.seeds,
            points: existing.points,
            fertilizer: existing.fertilizer,
            moonDew: existing.moonDew,
            growGoo: existing.growGoo,
            phoenixAsh: existing.phoenixAsh,
          },
          after: {
            seeds: player.seeds,
            points: player.points,
            fertilizer: player.fertilizer,
            moonDew: player.moonDew,
            growGoo: player.growGoo,
            phoenixAsh: player.phoenixAsh,
          },
          reason: body.reason || "manual adjust",
        },
      },
    });
    const config = await loadConfig();
    return { player: publicPlayer(player, config, false) };
  });

  app.post("/api/admin/players/:id/end-session", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const result = await prisma.playerSession.deleteMany({ where: { playerId: id } });
    await prisma.auditLog.create({
      data: {
        adminId: session.adminId,
        targetPlayerId: id,
        action: "end_session",
        details: { deleted: result.count },
      },
    });
    return { ok: true, ended: result.count };
  });

  app.post("/api/admin/players/:id/deactivate", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const { active } = (request.body ?? {}) as { active?: boolean };
    const isActive = active !== false ? Boolean(active) : false;
    const player = await prisma.player.update({
      where: { id },
      data: { isActive },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    if (!isActive) {
      await prisma.playerSession.deleteMany({ where: { playerId: id } });
    }
    await prisma.auditLog.create({
      data: {
        adminId: session.adminId,
        targetPlayerId: id,
        action: isActive ? "reactivate_player" : "deactivate_player",
      },
    });
    const config = await loadConfig();
    return { player: publicPlayer(player, config, false) };
  });

  app.get("/api/admin/config", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    return { config: await loadConfig(), defaults: DEFAULT_GAME_CONFIG };
  });

  app.put("/api/admin/config", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const body = (request.body ?? {}) as { config?: unknown };
    const saved = await saveConfig(mergeGameConfig(body.config));
    await prisma.auditLog.create({
      data: { adminId: session.adminId, action: "update_config", details: saved as object },
    });
    return { config: saved };
  });

  app.post("/api/admin/config/reset", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const saved = await saveConfig(DEFAULT_GAME_CONFIG);
    await prisma.auditLog.create({
      data: { adminId: session.adminId, action: "reset_config" },
    });
    return { config: saved };
  });

  app.get("/api/admin/activity", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const config = await loadConfig();
    const from = startOfDaysAgo(config.timezone, 6);
    const keys = chicagoDayKeys(config.timezone, 7);
    const players = await prisma.player.findMany({ orderBy: { createdAt: "asc" } });
    const logs = await prisma.activityLog.findMany({
      where: { createdAt: { gte: from }, action: { in: ["login", "watering", "harvest"] } },
    });

    const activity = players.map((player) => {
      const days = keys.map((day) => ({ day, logins: 0, waterings: 0, harvests: 0, points: 0 }));

      const playerLogs = logs.filter((log) => log.playerId === player.id);
      for (const log of playerLogs) {
        const day = todayKey(config.timezone, log.createdAt);
        const bucket = days.find((d) => d.day === day);
        if (!bucket) continue;
        if (log.action === "login") bucket.logins += 1;
        if (log.action === "watering") bucket.waterings += 1;
        if (log.action === "harvest") {
          bucket.harvests += 1;
          const details = log.details as { points?: number } | null;
          bucket.points += details?.points ?? 0;
        }
      }
      return {
        playerId: player.id,
        name: player.name,
        mascot: player.mascot,
        days,
        totals: days.reduce(
          (acc, day) => ({
            logins: acc.logins + day.logins,
            waterings: acc.waterings + day.waterings,
            harvests: acc.harvests + day.harvests,
            points: acc.points + day.points,
          }),
          { logins: 0, waterings: 0, harvests: 0, points: 0 },
        ),
      };
    });

    return { timezone: config.timezone, days: keys, activity };
  });

  app.get("/api/admin/audit", async (request, reply) => {
    const session = await requireAdmin(request, reply);
    if (!session) return;
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { admin: true, targetPlayer: true },
    });
    return {
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        details: log.details,
        createdAt: log.createdAt,
        admin: log.admin?.username ?? null,
        player: log.targetPlayer?.name ?? null,
      })),
    };
  });
}
