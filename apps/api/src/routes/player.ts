import type { FastifyInstance } from "fastify";
import { getTier } from "@farmhand/shared";
import { prisma } from "../db.js";
import {
  ADMIN_COOKIE,
  PLAYER_COOKIE,
  cookieOpts,
  getPlayerSession,
  hashToken,
  newToken,
  requirePlayer,
  verifySecret,
} from "../auth.js";
import { loadConfig, publicPlayer, wateringState } from "../game.js";
import { todayKey } from "../tz.js";

function pinError() {
  return { error: "That PIN didn't work. Try again." };
}

export async function playerRoutes(app: FastifyInstance) {
  app.get("/api/session", async (request) => {
    const session = await getPlayerSession(request);
    if (!session) return { player: null };
    const config = await loadConfig();
    return { player: publicPlayer(session.player, config, true), config, expiresAt: session.expiresAt };
  });

  app.post("/api/session/logout", async (request, reply) => {
    const session = await getPlayerSession(request);
    if (session) {
      await prisma.playerSession.delete({ where: { id: session.id } });
    }
    reply.clearCookie(PLAYER_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.post("/api/players/:id/enter", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { pin?: string };
    const player = await prisma.player.findUnique({
      where: { id },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    if (!player || !player.isActive) {
      return reply.code(404).send({ error: "That garden isn't on the farm right now." });
    }

    const existing = await getPlayerSession(request);
    if (existing?.playerId === player.id) {
      const config = await loadConfig();
      return { player: publicPlayer(player, config, true), config, skippedPin: true };
    }

    if (player.pinHash) {
      const pin = String(body.pin ?? "");
      if (!/^\d{4}$/.test(pin) || !(await verifySecret(pin, player.pinHash))) {
        return reply.code(401).send(pinError());
      }
    }

    const config = await loadConfig();
    const token = newToken();
    const expiresAt = new Date(Date.now() + config.sessionMinutes * 60 * 1000);
    await prisma.playerSession.create({
      data: { playerId: player.id, tokenHash: hashToken(token), expiresAt },
    });
    await prisma.activityLog.create({
      data: { playerId: player.id, action: "login", details: { via: player.pinHash ? "pin" : "open" } },
    });
    reply.setCookie(PLAYER_COOKIE, token, cookieOpts(config.sessionMinutes * 60));
    reply.clearCookie(ADMIN_COOKIE, { path: "/" });
    return { player: publicPlayer(player, config, true), config, skippedPin: false, expiresAt };
  });

  app.get("/api/garden", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: session.playerId },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    return { player: publicPlayer(player, config, true), config };
  });

  app.post("/api/plots/:slot/plant", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const slot = Number((request.params as { slot: string }).slot);
    const { tier } = (request.body ?? {}) as { tier?: number };
    const config = await loadConfig();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const player = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          include: { plots: true },
        });
        const plot = player.plots.find((p) => p.slot === slot);
        if (!plot) throw Object.assign(new Error("No plot there."), { statusCode: 404 });
        if (plot.plantedAt) throw Object.assign(new Error("That plot already has a plant."), { statusCode: 400 });
        const plantTier = getTier(config, Number(tier));
        if (player.seeds < plantTier.seedCost) {
          throw Object.assign(new Error("Not enough seeds for that plant."), { statusCode: 400 });
        }
        await tx.player.update({
          where: { id: player.id },
          data: { seeds: { decrement: plantTier.seedCost } },
        });
        await tx.plot.update({
          where: { id: plot.id },
          data: {
            plantTier: plantTier.tier,
            plantedAt: new Date(),
            waterReductionMinutes: 0,
            fertilizerReductionMinutes: 0,
          },
        });
        await tx.activityLog.create({
          data: { playerId: player.id, action: "plant", details: { slot, tier: plantTier.tier } },
        });
        return tx.player.findUniqueOrThrow({
          where: { id: player.id },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
      });
      return { player: publicPlayer(result, config, true) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/plots/:slot/water", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const slot = Number((request.params as { slot: string }).slot);
    const config = await loadConfig();
    const now = new Date();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const player = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          include: { plots: true },
        });
        const plot = player.plots.find((p) => p.slot === slot);
        if (!plot?.plantedAt || !plot.plantTier) {
          throw Object.assign(new Error("Nothing to water yet."), { statusCode: 400 });
        }
        const serialized = publicPlayer(player, config, true).plots.find((p) => p.slot === slot);
        if (serialized?.ready) {
          throw Object.assign(new Error("That plant is ready to harvest."), { statusCode: 400 });
        }
        const water = wateringState(player, config, now);
        if (water.cooldownRemainingMs > 0) {
          throw Object.assign(new Error("The watering can is still cooling off."), { statusCode: 400 });
        }
        if (water.wateringsLeft <= 0) {
          throw Object.assign(new Error("All waterings for today are used up."), { statusCode: 400 });
        }
        await tx.plot.update({
          where: { id: plot.id },
          data: { waterReductionMinutes: { increment: config.wateringReductionMinutes } },
        });
        await tx.player.update({
          where: { id: player.id },
          data: {
            lastWateredAt: now,
            wateringsOnDate: water.today,
            wateringsCount: water.wateringsUsed + 1,
          },
        });
        await tx.activityLog.create({
          data: { playerId: player.id, action: "watering", details: { slot } },
        });
        return tx.player.findUniqueOrThrow({
          where: { id: player.id },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
      });
      return { player: publicPlayer(result, config, true) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/plots/:slot/fertilize", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const slot = Number((request.params as { slot: string }).slot);
    const config = await loadConfig();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const player = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          include: { plots: true },
        });
        const plot = player.plots.find((p) => p.slot === slot);
        if (!plot?.plantedAt || !plot.plantTier) {
          throw Object.assign(new Error("Nothing to fertilize yet."), { statusCode: 400 });
        }
        const serialized = publicPlayer(player, config, true).plots.find((p) => p.slot === slot);
        if (serialized?.ready) {
          throw Object.assign(new Error("That plant is ready to harvest."), { statusCode: 400 });
        }
        if (player.fertilizer < 1) {
          throw Object.assign(new Error("No fertilizer left. Mix some in the shed."), { statusCode: 400 });
        }
        const tier = getTier(config, plot.plantTier);
        await tx.player.update({
          where: { id: player.id },
          data: { fertilizer: { decrement: 1 } },
        });
        await tx.plot.update({
          where: { id: plot.id },
          data: { fertilizerReductionMinutes: { increment: tier.fertilizerReductionMinutes } },
        });
        await tx.activityLog.create({
          data: { playerId: player.id, action: "fertilizer", details: { slot, tier: plot.plantTier } },
        });
        return tx.player.findUniqueOrThrow({
          where: { id: player.id },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
      });
      return { player: publicPlayer(result, config, true) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/plots/:slot/harvest", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const slot = Number((request.params as { slot: string }).slot);
    const config = await loadConfig();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const player = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          include: { plots: true },
        });
        const plot = player.plots.find((p) => p.slot === slot);
        if (!plot?.plantedAt || !plot.plantTier) {
          throw Object.assign(new Error("Nothing to harvest."), { statusCode: 400 });
        }
        const serialized = publicPlayer(player, config, true).plots.find((p) => p.slot === slot);
        if (!serialized?.ready) {
          throw Object.assign(new Error("That plant is still growing."), { statusCode: 400 });
        }
        const tier = getTier(config, plot.plantTier);
        await tx.player.update({
          where: { id: player.id },
          data: {
            points: { increment: tier.points },
            seeds: { increment: config.harvestSeedReturn },
          },
        });
        await tx.plot.update({
          where: { id: plot.id },
          data: {
            plantTier: null,
            plantedAt: null,
            waterReductionMinutes: 0,
            fertilizerReductionMinutes: 0,
          },
        });
        await tx.activityLog.create({
          data: {
            playerId: player.id,
            action: "harvest",
            details: { slot, tier: tier.tier, points: tier.points, seedsReturned: config.harvestSeedReturn },
          },
        });
        const updated = await tx.player.findUniqueOrThrow({
          where: { id: player.id },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
        return { player: updated, reward: { points: tier.points, seedsReturned: config.harvestSeedReturn, emoji: tier.emoji, name: tier.name } };
      });
      return { player: publicPlayer(result.player, config, true), reward: result.reward };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/ingredients/claim", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();
    const today = todayKey(config.timezone);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const player = await tx.player.findUniqueOrThrow({ where: { id: session.playerId } });
        if (player.lastIngredientClaimDate === today) {
          throw Object.assign(new Error("You already claimed today's ingredient."), { statusCode: 400 });
        }
        const ingredient = config.ingredients[player.nextIngredientIndex % config.ingredients.length];
        const data: Record<string, unknown> = {
          lastIngredientClaimDate: today,
          nextIngredientIndex: (player.nextIngredientIndex + 1) % config.ingredients.length,
        };
        if (ingredient.id === "moonDew") data.moonDew = { increment: 1 };
        if (ingredient.id === "growGoo") data.growGoo = { increment: 1 };
        if (ingredient.id === "phoenixAsh") data.phoenixAsh = { increment: 1 };
        await tx.player.update({ where: { id: player.id }, data });
        await tx.activityLog.create({
          data: { playerId: player.id, action: "ingredient_claim", details: { ingredient: ingredient.id } },
        });
        return { ingredient, player: await tx.player.findUniqueOrThrow({
          where: { id: player.id },
          include: { plots: { orderBy: { slot: "asc" } } },
        }) };
      });
      return { player: publicPlayer(result.player, config, true), claimed: result.ingredient };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/ingredients/mix", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();

    try {
      const result = await prisma.$transaction(async (tx) => {
        const player = await tx.player.findUniqueOrThrow({ where: { id: session.playerId } });
        if (player.moonDew < 1 || player.growGoo < 1 || player.phoenixAsh < 1) {
          throw Object.assign(new Error("Need one of each ingredient to mix fertilizer."), { statusCode: 400 });
        }
        await tx.player.update({
          where: { id: player.id },
          data: {
            moonDew: { decrement: 1 },
            growGoo: { decrement: 1 },
            phoenixAsh: { decrement: 1 },
            fertilizer: { increment: config.mixYield },
          },
        });
        await tx.activityLog.create({
          data: { playerId: player.id, action: "mix_fertilizer", details: { yield: config.mixYield } },
        });
        return tx.player.findUniqueOrThrow({
          where: { id: player.id },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
      });
      return { player: publicPlayer(result, config, true) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });
}
