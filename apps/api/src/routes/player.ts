import { createReadStream, constants as fsConstants, promises as fsPromises } from "node:fs";
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
import { notifyChoreClaimPending, notifyStoreRedemptionPending } from "../push.js";
import { listActiveCatalog, playerStore, requestStoreSku } from "../store.js";
import { playerProfile } from "../profile.js";
import {
  decodeSelfiePayload,
  inspectJpeg,
  isPlayerSelfieBasename,
  planSelfieReward,
  selfieFilePath,
  writeClaimJpeg,
  writeSelfieJpeg,
} from "../selfie.js";
import { appendStarEvent } from "../stars.js";
import { todayKey } from "../tz.js";
import { withLockedPlot, withLockedPlayer } from "../locks.js";

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
      const result = await withLockedPlayer(session.playerId, async (tx, lockedPlayer) => {
        // Re-read selfie dates AFTER lock — prevents concurrent selfies from
        // granting two seeds on the same day.
        const plan = planSelfieReward(lockedPlayer, today);
        const updated = await tx.player.update({
          where: { id: session.playerId },
          data: {
            selfieUnlockDate: today,
            selfieSeedGrantDate: today,
            ...(plan.grantSeed ? { seeds: { increment: 1 } } : {}),
          },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
        await tx.activityLog.create({
          data: {
            playerId: session.playerId,
            action: "selfie",
            details: { seedGranted: plan.grantSeed, alreadyUnlocked: plan.alreadyUnlocked, file },
          },
        });
        const unlocks = plan.alreadyUnlocked
          ? []
          : await recordAccoladeEvent(tx, {
              playerId: session.playerId,
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
      const result = await withLockedPlayer(session.playerId, async (tx, lockedPlayer) => {
        // Re-read seeds AFTER lock — prevents concurrent plants from both
        // passing the seed check on the same pre-lock snapshot.
        if (!Number.isInteger(slot) || slot < 0 || slot >= config.plotCount) {
          throw Object.assign(new Error("No plot there."), { statusCode: 404 });
        }
        const plot = await tx.plot.findFirst({
          where: { playerId: session.playerId, slot },
        }) ?? await tx.plot.create({ data: { playerId: session.playerId, slot } });
        if (plot.plantTier) throw Object.assign(new Error("That plot already has a plant."), { statusCode: 400 });
        const plantTier = getTier(config, Number(tier));
        const totalSeeds = lockedPlayer.seeds + lockedPlayer.provisionalSeeds;
        if (totalSeeds < plantTier.seedCost) {
          throw Object.assign(new Error("Not enough seeds for that plant."), { statusCode: 400 });
        }

        let choreClaimId: string | null = null;
        let phase: "growing" | "purgatory" = "growing";

        if (lockedPlayer.seeds >= plantTier.seedCost) {
          // Use approved seeds — plant directly as growing
          await tx.player.update({
            where: { id: session.playerId },
            data: { seeds: { decrement: plantTier.seedCost } },
          });
        } else {
          // Not enough approved seeds — use a provisional seed
          const approvedUsed = lockedPlayer.seeds;
          const provisionalNeeded = plantTier.seedCost - approvedUsed;

          // Consume all approved seeds first
          if (approvedUsed > 0) {
            await tx.player.update({
              where: { id: session.playerId },
              data: { seeds: { decrement: approvedUsed } },
            });
          }

          // Find the oldest PENDING claim for this player without a linked plot
          const pendingClaim = await tx.choreClaim.findFirst({
            where: {
              playerId: session.playerId,
              status: "PENDING",
              slot: null,
            },
            orderBy: { claimedAt: "asc" },
          });

          if (!pendingClaim) {
            throw Object.assign(new Error("No pending chore claim for provisional seed."), { statusCode: 400 });
          }

          // Link the claim to this plot and set plant tier
          await tx.choreClaim.update({
            where: { id: pendingClaim.id },
            data: { slot, plantTier: plantTier.tier },
          });

          // Consume provisional seeds
          await tx.player.update({
            where: { id: session.playerId },
            data: { provisionalSeeds: { decrement: provisionalNeeded } },
          });

          choreClaimId = pendingClaim.id;
          phase = "purgatory";
        }

        await tx.plot.update({
          where: { id: plot.id },
          data: {
            plantTier: plantTier.tier,
            plantedAt: phase === "growing" ? new Date() : null,
            phase,
            choreClaimId,
            waterReductionMinutes: 0,
            fertilizerReductionMinutes: 0,
            lastWateredAt: null,
            wateringsOnDate: null,
            wateringsCount: 0,
          },
        });
        await tx.activityLog.create({
          data: { playerId: session.playerId, action: "plant", details: { slot, tier: plantTier.tier, phase, choreClaimId } },
        });
        const unlocks = await recordAccoladeEvent(tx, {
          playerId: session.playerId,
          timezone: config.timezone,
          event: { type: "planting" },
        });
        const updated = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
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
      const result = await withLockedPlot(session.playerId, slot, async (tx, lockedPlot) => {
        // Re-read plot state AFTER lock — prevents concurrent waterings from
        // both passing the daily-cap check on the same pre-lock snapshot.
        if (!lockedPlot || plotIsEmpty(lockedPlot)) {
          throw Object.assign(new Error("Nothing to water yet."), { statusCode: 400 });
        }
        const serialized = serializePlot(lockedPlot, config, now);
        if (serialized.state === "purgatory") {
          throw Object.assign(new Error("That plant is waiting for a grown-up."), { statusCode: 400 });
        }
        if (serialized.state === "wilted") {
          throw Object.assign(new Error("Prune that wilted plant first."), { statusCode: 400 });
        }
        if (!lockedPlot.plantedAt || !lockedPlot.plantTier) {
          throw Object.assign(new Error("Nothing to water yet."), { statusCode: 400 });
        }
        if (serialized.ready) {
          throw Object.assign(new Error("That plant is ready to harvest."), { statusCode: 400 });
        }
        // Read player for selfie check — unlocked state is static per-day so lock is not critical here
        const player = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
        });
        if (!selfieUnlockedOn(player.selfieUnlockDate, config.timezone, now)) {
          throw Object.assign(new Error("Take today's selfie to water your plants."), { statusCode: 400 });
        }
        const pw = plotWateringState(lockedPlot, config, now);
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
          where: { id: lockedPlot.id },
          data: {
            waterReductionMinutes: { increment: config.wateringReductionMinutes },
            lastWateredAt: now,
            wateringsOnDate: pw.today,
            wateringsCount: pw.wateringsUsed + 1,
          },
        });
        await tx.player.update({
          where: { id: session.playerId },
          data: {
            lastWateredAt: now,
            wateringsOnDate: pw.today,
            wateringsCount: player.wateringsOnDate === pw.today ? player.wateringsCount + 1 : 1,
          },
        });
        await tx.activityLog.create({
          data: { playerId: session.playerId, action: "watering", details: { slot } },
        });
        const unlocks = await recordAccoladeEvent(tx, {
          playerId: session.playerId,
          timezone: config.timezone,
          event: { type: "watering" },
        });
        const updated = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
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

  /** Fertilizer disabled — incomplete, reserved for a future phase. */
  app.post("/api/plots/:slot/fertilize", async (_request, reply) => {
    return reply.code(501).send({ error: "Fertilizer is not available yet. Coming in a future update!" });
  });

  app.post("/api/plots/:slot/harvest", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const slot = Number((request.params as { slot: string }).slot);
    const config = await loadConfig();

    try {
      const result = await withLockedPlot(session.playerId, slot, async (tx, lockedPlot) => {
        // Re-read state AFTER lock — if another request already cleared this
        // plot, the re-read will show empty/cleared state and validation fails.
        if (!lockedPlot.plantedAt || !lockedPlot.plantTier) {
          throw Object.assign(new Error("Nothing to harvest."), { statusCode: 400 });
        }
        const serialized = serializePlot(lockedPlot, config);
        if (serialized.state === "purgatory" || serialized.state === "wilted") {
          throw Object.assign(new Error("That plant isn't ready to harvest."), { statusCode: 400 });
        }
        if (!serialized.ready) {
          throw Object.assign(new Error("That plant is still growing."), { statusCode: 400 });
        }
        const tier = getTier(config, lockedPlot.plantTier);
        // Shard-based harvest: add shard refund, then convert accumulated shards to whole seeds.
        const player = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          select: { seedShards: true },
        });
        const currentShards = player.seedShards;
        const totalShards = currentShards + (tier.shardRefund ?? 0);
        const seedsFromShards = Math.floor(totalShards / config.shardsPerSeed);
        const remainingShards = totalShards % config.shardsPerSeed;
        await tx.player.update({
          where: { id: session.playerId },
          data: {
            points: { increment: tier.points },
            seeds: { increment: seedsFromShards },
            seedShards: remainingShards,
          },
        });
        await releaseClaimIfNeeded(tx, lockedPlot, "harvest");
        await tx.plot.update({
          where: { id: lockedPlot.id },
          data: EMPTY_PLOT_DATA,
        });
        const harvestLog = await tx.activityLog.create({
          data: {
            playerId: session.playerId,
            action: "harvest",
            details: {
              slot,
              tier: tier.tier,
              points: tier.points,
              shardsEarned: tier.shardRefund ?? 0,
              seedsFromShards,
              remainingShards,
            },
          },
        });
        await appendStarEvent(tx, {
          playerId: session.playerId,
          kind: "EARN_HARVEST",
          amount: tier.points,
          idempotencyKey: `earn:harvest:${harvestLog.id}`,
          source: "harvest",
          meta: { slot, tier: tier.tier },
        });
        const unlocks = await recordAccoladeEvent(tx, {
          playerId: session.playerId,
          timezone: config.timezone,
          event: { type: "harvest", cropKind: tier.kind },
        });
        const updated = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          include: { plots: { orderBy: { slot: "asc" } } },
        });
        return {
          player: updated,
          unlocks,
          reward: {
            points: tier.points,
            shardsEarned: tier.shardRefund ?? 0,
            seedsFromShards,
            remainingShards,
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
      player: publicPlayer(player, config, true),
    };
  });

  app.post("/api/chores/:id/claim", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { image?: unknown };
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

  /** Ingredient claim disabled — fertilizer is incomplete, reserved for a future phase. */
  app.post("/api/ingredients/claim", async (_request, reply) => {
    return reply.code(501).send({ error: "Ingredient claiming is not available yet. Coming in a future update!" });
  });

  /** Mix disabled — fertilizer is incomplete, reserved for a future phase. */
  app.post("/api/ingredients/mix", async (_request, reply) => {
    return reply.code(501).send({ error: "Mixing ingredients is not available yet. Coming in a future update!" });
  });

  app.get("/api/store/catalog", async () => {
    const catalog = await listActiveCatalog();
    return { catalog };
  });

  app.get("/api/store", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    return playerStore(session.playerId);
  });

  app.post("/api/store/request", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const body = (request.body ?? {}) as { skuId?: unknown };
    const skuId = typeof body.skuId === "string" ? body.skuId : "";
    if (!skuId) return reply.code(400).send({ error: "Pick a reward first." });
    try {
      const result = await requestStoreSku(session.playerId, skuId);
      void notifyStoreRedemptionPending({
        redemptionId: result.redemption.id,
        playerName: result.playerName,
        title: result.skuTitle,
      }).catch((err) => request.log.warn({ err }, "store request push failed"));
      const store = await playerStore(session.playerId);
      return {
        ok: true,
        redemption: {
          id: result.redemption.id,
          status: "pending",
          title: result.redemption.title,
          emoji: result.redemption.emoji,
          starCost: result.redemption.starCost,
        },
        ...store,
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.get("/api/profile", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    return playerProfile(session.playerId);
  });

  app.get("/api/profile/selfies/:file", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const file = decodeURIComponent((request.params as { file: string }).file);
    if (!isPlayerSelfieBasename(session.playerId, file)) {
      return reply.code(404).send({ error: "That photo isn't here." });
    }
    const full = selfieFilePath(file);
    try {
      await fsPromises.access(full, fsConstants.R_OK);
    } catch {
      return reply.code(404).send({ error: "That photo isn't here." });
    }
    reply.header("Content-Type", "image/jpeg");
    reply.header("Cache-Control", "private, max-age=120");
    return reply.send(createReadStream(full));
  });
}
