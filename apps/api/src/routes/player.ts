import type { FastifyInstance } from "fastify";
import { getTier, plotIsEmpty, serializePlot } from "@farmhand/shared";
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
import { claimChore, EMPTY_PLOT_DATA, listPlayerChores, prunePlot, releaseClaimIfNeeded } from "../chores.js";
import { loadConfig, plotWateringState, publicPlayer, selfieUnlockedOn, syncPlayerPlots } from "../game.js";
import { recordAccoladeEvent, playerAccoladeLedger } from "../accolades.js";
import { notifyChoreClaimPending } from "../push.js";
import { decodeSelfiePayload, inspectJpeg, planSelfieReward, writeClaimJpeg, writeSelfieJpeg } from "../selfie.js";
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
      await syncPlayerPlots(player.id, config.plotCount);
      const fresh = await prisma.player.findUniqueOrThrow({
        where: { id: player.id },
        include: { plots: { orderBy: { slot: "asc" } } },
      });
      return { player: publicPlayer(fresh, config, true), config, skippedPin: true };
    }

    if (player.pinHash) {
      const pin = String(body.pin ?? "");
      if (!/^\d{4}$/.test(pin) || !(await verifySecret(pin, player.pinHash))) {
        return reply.code(401).send(pinError());
      }
    }

    const config = await loadConfig();
    await syncPlayerPlots(player.id, config.plotCount);
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
    const fresh = await prisma.player.findUniqueOrThrow({
      where: { id: player.id },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    return { player: publicPlayer(fresh, config, true), config, skippedPin: false, expiresAt };
  });

  app.get("/api/garden", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();
    await syncPlayerPlots(session.playerId, config.plotCount);
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: session.playerId },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    return { player: publicPlayer(player, config, true), config };
  });

  app.get("/api/accolades", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();
    return playerAccoladeLedger(session.playerId, config.timezone);
  });

  app.get("/api/selfie", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();
    const today = todayKey(config.timezone);
    return {
      today,
      unlocked: selfieUnlockedOn(session.player.selfieUnlockDate, config.timezone),
      seedGrantedToday: session.player.selfieSeedGrantDate === today,
    };
  });

  app.post("/api/selfie", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();
    const today = todayKey(config.timezone);
    const body = (request.body ?? {}) as { image?: unknown; jpeg?: unknown };
    try {
      const buf = decodeSelfiePayload(body.image ?? body.jpeg);
      inspectJpeg(buf);
      const file = await writeSelfieJpeg({
        buf,
        playerId: session.playerId,
        playerName: session.player.name,
        today,
      });
      const result = await prisma.$transaction(async (tx) => {
        const player = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
        const plan = planSelfieReward(player, today);
        const updated = await tx.player.update({
          where: { id: player.id },
          data: {
            selfieUnlockDate: today,
            selfieSeedGrantDate: today,
            ...(plan.grantSeed ? { seeds: { increment: 1 } } : {}),
          },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
        await tx.activityLog.create({
          data: {
            playerId: player.id,
            action: "selfie",
            details: { seedGranted: plan.grantSeed, alreadyUnlocked: plan.alreadyUnlocked, file },
          },
        });
        const unlocks = plan.alreadyUnlocked
          ? []
          : await recordAccoladeEvent(tx, {
              playerId: player.id,
              timezone: config.timezone,
              event: { type: "selfie" },
            });
        return { player: updated, plan, unlocks };
      });
      return {
        player: publicPlayer(result.player, config, true),
        today,
        unlocked: true,
        seedGranted: result.plan.grantSeed,
        alreadyUnlocked: result.plan.alreadyUnlocked,
        reward: result.plan.grantSeed ? { seedsReturned: 1, points: 0 } : { seedsReturned: 0, points: 0 },
        unlocks: result.unlocks,
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
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
        if (!Number.isInteger(slot) || slot < 0 || slot >= config.plotCount) {
          throw Object.assign(new Error("No plot there."), { statusCode: 404 });
        }
        const plot =
          player.plots.find((p) => p.slot === slot) ??
          (await tx.plot.create({ data: { playerId: player.id, slot } }));
        if (plot.plantTier) throw Object.assign(new Error("That plot already has a plant."), { statusCode: 400 });
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
            phase: "growing",
            choreClaimId: null,
            waterReductionMinutes: 0,
            fertilizerReductionMinutes: 0,
            lastWateredAt: null,
            wateringsOnDate: null,
            wateringsCount: 0,
          },
        });
        await tx.activityLog.create({
          data: { playerId: player.id, action: "plant", details: { slot, tier: plantTier.tier } },
        });
        const unlocks = await recordAccoladeEvent(tx, {
          playerId: player.id,
          timezone: config.timezone,
          event: { type: "planting" },
        });
        const updated = await tx.player.findUniqueOrThrow({
          where: { id: player.id },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
        return { player: updated, unlocks };
      });
      return { player: publicPlayer(result.player, config, true), unlocks: result.unlocks };
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
        if (!plot || plotIsEmpty(plot)) {
          throw Object.assign(new Error("Nothing to water yet."), { statusCode: 400 });
        }
        const serialized = serializePlot(plot, config, now);
        if (serialized.state === "purgatory") {
          throw Object.assign(new Error("That plant is waiting for a grown-up."), { statusCode: 400 });
        }
        if (serialized.state === "wilted") {
          throw Object.assign(new Error("Prune that wilted plant first."), { statusCode: 400 });
        }
        if (!plot.plantedAt || !plot.plantTier) {
          throw Object.assign(new Error("Nothing to water yet."), { statusCode: 400 });
        }
        if (serialized.ready) {
          throw Object.assign(new Error("That plant is ready to harvest."), { statusCode: 400 });
        }
        if (!selfieUnlockedOn(player.selfieUnlockDate, config.timezone, now)) {
          throw Object.assign(new Error("Take today's selfie to water your plants."), { statusCode: 400 });
        }
        const pw = plotWateringState(plot, config, now);
        if (pw.cooldownRemainingMs > 0) {
          throw Object.assign(new Error("That plant already had a drink. Wait a bit."), { statusCode: 400 });
        }
        if (pw.wateringsLeft <= 0) {
          throw Object.assign(
            new Error(`That plant already had ${config.wateringMaxPerDay} waters today.`),
            { statusCode: 400 },
          );
        }
        await tx.plot.update({
          where: { id: plot.id },
          data: {
            waterReductionMinutes: { increment: config.wateringReductionMinutes },
            lastWateredAt: now,
            wateringsOnDate: pw.today,
            wateringsCount: pw.wateringsUsed + 1,
          },
        });
        await tx.player.update({
          where: { id: player.id },
          data: {
            lastWateredAt: now,
            wateringsOnDate: pw.today,
            wateringsCount: player.wateringsOnDate === pw.today ? player.wateringsCount + 1 : 1,
          },
        });
        await tx.activityLog.create({
          data: { playerId: player.id, action: "watering", details: { slot } },
        });
        const unlocks = await recordAccoladeEvent(tx, {
          playerId: player.id,
          timezone: config.timezone,
          event: { type: "watering" },
        });
        const updated = await tx.player.findUniqueOrThrow({
          where: { id: player.id },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
        return { player: updated, unlocks };
      });
      return { player: publicPlayer(result.player, config, true), unlocks: result.unlocks };
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
        if (!plot || plotIsEmpty(plot)) {
          throw Object.assign(new Error("Nothing to fertilize yet."), { statusCode: 400 });
        }
        const serialized = serializePlot(plot, config);
        if (serialized.state === "purgatory") {
          throw Object.assign(new Error("That plant is waiting for a grown-up."), { statusCode: 400 });
        }
        if (serialized.state === "wilted") {
          throw Object.assign(new Error("Prune that wilted plant first."), { statusCode: 400 });
        }
        if (!plot.plantedAt || !plot.plantTier) {
          throw Object.assign(new Error("Nothing to fertilize yet."), { statusCode: 400 });
        }
        if (serialized.ready) {
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
        const serialized = serializePlot(plot, config);
        if (serialized.state === "purgatory" || serialized.state === "wilted") {
          throw Object.assign(new Error("That plant isn't ready to harvest."), { statusCode: 400 });
        }
        if (!serialized.ready) {
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
        await releaseClaimIfNeeded(tx, plot, "harvest");
        await tx.plot.update({
          where: { id: plot.id },
          data: EMPTY_PLOT_DATA,
        });
        await tx.activityLog.create({
          data: {
            playerId: player.id,
            action: "harvest",
            details: { slot, tier: tier.tier, points: tier.points, seedsReturned: config.harvestSeedReturn },
          },
        });
        const unlocks = await recordAccoladeEvent(tx, {
          playerId: player.id,
          timezone: config.timezone,
          event: { type: "harvest", cropKind: tier.kind },
        });
        const updated = await tx.player.findUniqueOrThrow({
          where: { id: player.id },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
        return {
          player: updated,
          unlocks,
          reward: {
            points: tier.points,
            seedsReturned: config.harvestSeedReturn,
            emoji: tier.emoji,
            name: tier.name,
            kind: tier.kind,
          },
        };
      });
      return { player: publicPlayer(result.player, config, true), reward: result.reward, unlocks: result.unlocks };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.get("/api/chores", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();
    await syncPlayerPlots(session.playerId, config.plotCount);
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: session.playerId },
      include: { plots: { orderBy: { slot: "asc" } } },
    });
    const chores = await listPlayerChores(session.playerId, config.timezone);
    return {
      timezone: config.timezone,
      chores,
      emptySlots: player.plots.filter((plot) => plotIsEmpty(plot)).map((plot) => plot.slot),
      player: publicPlayer(player, config, true),
    };
  });

  app.post("/api/chores/:id/claim", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { slot?: number; tier?: number; image?: unknown };
    const config = await loadConfig();
    try {
      const chore = await prisma.chore.findUnique({ where: { id } });
      if (!chore) return reply.code(404).send({ error: "That chore isn't on the list." });
      let proofBuf: Buffer | null = null;
      if (chore.requiresSelfie) {
        proofBuf = decodeSelfiePayload(body.image);
        inspectJpeg(proofBuf);
      }
      const result = await claimChore({
        playerId: session.playerId,
        choreId: id,
        slot: Number(body.slot),
        tier: Number(body.tier ?? 1),
        timezone: config.timezone,
        config,
        proofPath: null,
        hasProof: Boolean(proofBuf),
      });
      if (proofBuf) {
        const proofPath = await writeClaimJpeg({
          buf: proofBuf,
          playerName: session.player.name,
          choreSlug: chore.slug,
          claimId: result.claim.id,
        });
        await prisma.choreClaim.update({
          where: { id: result.claim.id },
          data: { proofJpegPath: proofPath },
        });
      }
      void notifyChoreClaimPending({
        claimId: result.claim.id,
        playerName: session.player.name,
        title: result.chore.title,
        emoji: result.chore.emoji,
        priority: result.chore.priority,
      }).catch((err) => request.log.warn({ err }, "chore claim push failed"));
      const player = await prisma.player.findUniqueOrThrow({
        where: { id: session.playerId },
        include: { plots: { orderBy: { slot: "asc" } } },
      });
      return {
        player: publicPlayer(player, config, true),
        claim: { id: result.claim.id, status: result.claim.status, slot: result.claim.slot },
        unlocks: result.unlocks ?? [],
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.post("/api/plots/:slot/prune", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const slot = Number((request.params as { slot: string }).slot);
    const config = await loadConfig();
    try {
      const player = await prunePlot(session.playerId, slot, config);
      return { player: publicPlayer(player, config, true) };
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
