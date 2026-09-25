import { randomUUID } from "node:crypto";
import { createReadStream, constants as fsConstants, promises as fsPromises } from "node:fs";
import type { FastifyInstance } from "fastify";
import {
  allocateProvisionalFromClaims,
  getTier,
  harvestBlockedWhilePending,
  PARENT_NOTIFY_COOLDOWN_MS,
  parentNotifyGate,
  planSeedSpend,
  plotIsEmpty,
  serializePlot,
} from "@farmhand/shared";
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
import { notifyApprovalsPending, notifyChoreClaimPending, notifyStoreRedemptionPending } from "../push.js";
import { listActiveCatalog, playerStore, requestStoreSku } from "../store.js";
import { playerProfile } from "../profile.js";
import { playerReview } from "../playerReview.js";
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
import { recordChoreBoardEvent } from "../choreHeat.js";
import { skipChore } from "../choreSkip.js";
import { AVATAR_PRESETS } from "@farmhand/shared";
import {
  avatarSelfieFilePath,
  decodeAndInspectAvatarImage,
  isPlayerAvatarSelfieBasename,
  validateAvatarBody,
  writeAvatarSelfieJpeg,
} from "../avatar.js";

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
      include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
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
        include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
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
      include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
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
      include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
    });
    return { player: publicPlayer(player, config, true), config };
  });

  app.get("/api/garden/review", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    return playerReview(session.playerId);
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
          include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
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
        const plot =
          (await tx.plot.findFirst({
            where: { playerId: session.playerId, slot },
          })) ?? (await tx.plot.create({ data: { playerId: session.playerId, slot } }));
        if (plot.plantTier) throw Object.assign(new Error("That plot already has a plant."), { statusCode: 400 });
        const plantTier = getTier(config, Number(tier));

        let spend: ReturnType<typeof planSeedSpend>;
        try {
          spend = planSeedSpend(lockedPlayer.seeds, lockedPlayer.provisionalSeeds, plantTier.seedCost);
        } catch (err) {
          throw Object.assign(new Error((err as Error).message), { statusCode: 400 });
        }

        let choreClaimId: string | null = null;
        const claimAllocations: Array<{ claimId: string; seedsUsed: number }> = [];

        if (spend.confirmedUsed > 0) {
          await tx.player.update({
            where: { id: session.playerId },
            data: { seeds: { decrement: spend.confirmedUsed } },
          });
        }

        if (spend.provisionalUsed > 0) {
          const pendingClaims = await tx.choreClaim.findMany({
            where: { playerId: session.playerId, status: "PENDING" },
            orderBy: { claimedAt: "asc" },
          });
          const buckets = pendingClaims
            .map((claim) => ({
              id: claim.id,
              seedsGranted: claim.seedsGranted ?? 1,
              seedsPlanted: claim.seedsPlanted ?? 0,
            }))
            .filter((b) => b.seedsGranted - b.seedsPlanted > 0);

          try {
            claimAllocations.push(...allocateProvisionalFromClaims(buckets, spend.provisionalUsed));
          } catch (err) {
            throw Object.assign(new Error((err as Error).message), { statusCode: 400 });
          }

          await tx.player.update({
            where: { id: session.playerId },
            data: { provisionalSeeds: { decrement: spend.provisionalUsed } },
          });

          for (const alloc of claimAllocations) {
            await tx.choreClaim.update({
              where: { id: alloc.claimId },
              data: {
                seedsPlanted: { increment: alloc.seedsUsed },
                slot,
                plantTier: plantTier.tier,
              },
            });
          }
          choreClaimId = claimAllocations[0]?.claimId ?? null;
        }

        // Always grow immediately. Harvest stays gated while linked claims are PENDING.
        const plantedAt = new Date();
        await tx.plot.update({
          where: { id: plot.id },
          data: {
            plantTier: plantTier.tier,
            plantedAt,
            phase: "growing",
            choreClaimId,
            waterReductionMinutes: 0,
            fertilizerReductionMinutes: 0,
            lastWateredAt: null,
            wateringsOnDate: null,
            wateringsCount: 0,
          },
        });

        if (claimAllocations.length > 0) {
          await tx.plotClaimLink.createMany({
            data: claimAllocations.map((alloc) => ({
              plotId: plot.id,
              claimId: alloc.claimId,
              seedsUsed: alloc.seedsUsed,
            })),
          });
        }

        await tx.activityLog.create({
          data: {
            playerId: session.playerId,
            action: "plant",
            details: {
              slot,
              tier: plantTier.tier,
              phase: "growing",
              choreClaimId,
              confirmedUsed: spend.confirmedUsed,
              provisionalUsed: spend.provisionalUsed,
              claimIds: claimAllocations.map((a) => a.claimId),
            },
          },
        });
        const unlocks = await recordAccoladeEvent(tx, {
          playerId: session.playerId,
          timezone: config.timezone,
          event: { type: "planting" },
        });
        const updated = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          include: {
            plots: {
              orderBy: { slot: "asc" },
              include: { claimLinks: { include: { claim: { include: { chore: true } } } } },
            },
            basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } },
          },
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
        // Pending-approval plants may still be watered; only wilted is blocked here.
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
          include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
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
        if (serialized.state === "wilted") {
          throw Object.assign(new Error("That plant isn't ready to harvest."), { statusCode: 400 });
        }
        const pendingLinks = await tx.plotClaimLink.count({
          where: { plotId: lockedPlot.id, claim: { status: "PENDING" } },
        });
        if (harvestBlockedWhilePending(pendingLinks)) {
          throw Object.assign(new Error("That plant is waiting on a grown-up before harvest."), { statusCode: 400 });
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
        // Stars wait in the basket. Seeds and shards are not produce, so they pay now.
        await tx.player.update({
          where: { id: session.playerId },
          data: {
            seeds: { increment: seedsFromShards },
            seedShards: remainingShards,
          },
        });
        const basketItem = await tx.basketItem.create({
          data: {
            playerId: session.playerId,
            cropKind: tier.kind,
            name: tier.name,
            emoji: tier.emoji,
            points: tier.points,
            status: "held",
          },
        });
        await releaseClaimIfNeeded(tx, lockedPlot, "harvest");
        await tx.plot.update({
          where: { id: lockedPlot.id },
          data: EMPTY_PLOT_DATA,
        });
        await tx.activityLog.create({
          data: {
            playerId: session.playerId,
            action: "harvest",
            details: {
              slot,
              tier: tier.tier,
              points: tier.points,
              basketItemId: basketItem.id,
              shardsEarned: tier.shardRefund ?? 0,
              seedsFromShards,
              remainingShards,
            },
          },
        });
        const unlocks = await recordAccoladeEvent(tx, {
          playerId: session.playerId,
          timezone: config.timezone,
          event: { type: "harvest", cropKind: tier.kind },
        });
        const updated = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
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
            basketItemId: basketItem.id,
          },
        };
      });
      return { player: publicPlayer(result.player, config, true), reward: result.reward, unlocks: result.unlocks };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });


  /**
   * Convert every held basket item into stars. Idempotent: a retry after the
   * rows are marked sold finds nothing held and pays nothing again.
   */
  app.post("/api/basket/sell", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();
    try {
      const result = await withLockedPlayer(session.playerId, async (tx) => {
        const held = await tx.basketItem.findMany({
          where: { playerId: session.playerId, status: "held" },
          orderBy: { createdAt: "asc" },
        });
        if (held.length === 0) {
          const player = await tx.player.findUniqueOrThrow({
            where: { id: session.playerId },
            include: {
              plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            },
              basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } },
            },
          });
          return { player, soldPoints: 0, previousPoints: player.points, items: [] as typeof held };
        }
        const soldPoints = held.reduce((sum, item) => sum + item.points, 0);
        const saleId = randomUUID();
        const soldAt = new Date();
        await tx.basketItem.updateMany({
          where: { id: { in: held.map((item) => item.id) }, status: "held" },
          data: { status: "sold", soldAt, saleId },
        });
        const playerBefore = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          select: { points: true },
        });
        await tx.player.update({
          where: { id: session.playerId },
          data: { points: { increment: soldPoints } },
        });
        await tx.activityLog.create({
          data: {
            playerId: session.playerId,
            action: "basket_sell",
            details: {
              saleId,
              soldPoints,
              itemIds: held.map((item) => item.id),
            },
          },
        });
        await appendStarEvent(tx, {
          playerId: session.playerId,
          kind: "EARN_HARVEST",
          amount: soldPoints,
          idempotencyKey: `earn:basket:${saleId}`,
          source: "basket",
          meta: {
            saleId,
            items: held.map((item) => ({ id: item.id, kind: item.cropKind, points: item.points })),
          },
        });
        const player = await tx.player.findUniqueOrThrow({
          where: { id: session.playerId },
          include: {
            plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            },
            basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } },
          },
        });
        return { player, soldPoints, previousPoints: playerBefore.points, items: held };
      });
      return {
        player: publicPlayer(result.player, config, true),
        soldPoints: result.soldPoints,
        previousPoints: result.previousPoints,
        items: result.items.map((item) => ({
          id: item.id,
          kind: item.cropKind,
          name: item.name,
          emoji: item.emoji,
          points: item.points,
        })),
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  // HEAT: fire-and-forget board events (open/dismiss/impression). Claim is recorded server-side.
  app.post("/api/chores/board-events", async (request, reply) => {
    const body = (request.body ?? {}) as {
      eventType?: string;
      source?: string;
      choreId?: string | null;
      suggestedSlot?: boolean | null;
      meta?: unknown;
    };
    const allowedType = new Set(["BOARD_OPEN", "CLAIM", "DISMISS", "RIGHT_NOW_IMPRESSION"]);
    const allowedSource = new Set(["GARDEN_JOB_BOARD", "FARM_CORKBOARD"]);
    if (!body.eventType || !allowedType.has(body.eventType)) {
      return reply.code(400).send({ error: "Invalid eventType." });
    }
    if (!body.source || !allowedSource.has(body.source)) {
      return reply.code(400).send({ error: "Invalid source." });
    }
    // CLAIM is authoritative on the claim path — ignore client CLAIM to avoid double-count.
    if (body.eventType === "CLAIM") {
      return { ok: true, ignored: true };
    }
    const session = await getPlayerSession(request);
    try {
      await recordChoreBoardEvent({
        eventType: body.eventType as "BOARD_OPEN" | "DISMISS" | "RIGHT_NOW_IMPRESSION",
        source: body.source as "GARDEN_JOB_BOARD" | "FARM_CORKBOARD",
        choreId: body.choreId ?? null,
        playerId: session?.playerId ?? null,
        suggestedSlot: body.suggestedSlot ?? null,
        meta: (body.meta ?? undefined) as never,
      });
      return { ok: true };
    } catch (err) {
      request.log.warn({ err }, "board event record failed");
      return { ok: false };
    }
  });

  app.get("/api/chores", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const config = await loadConfig();
    await syncPlayerPlots(session.playerId, config.plotCount);
    const player = await prisma.player.findUniqueOrThrow({
      where: { id: session.playerId },
      include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
    });
    const chores = await listPlayerChores(session.playerId, config.timezone);
    return {
      timezone: config.timezone,
      chores,
      player: publicPlayer(player, config, true),
    };
  });


  app.post("/api/chores/:id/skip", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const { id } = request.params as { id: string };
    const config = await loadConfig();
    try {
      const result = await skipChore({
        playerId: session.playerId,
        choreId: id,
        timezone: config.timezone,
      });
      const chores = await listPlayerChores(session.playerId, config.timezone);
      return {
        player: publicPlayer(result.player, config, true),
        claim: { id: result.claim.id, status: result.claim.status, slot: null },
        shardsGranted: result.shardsGranted,
        chores,
        toast: `Not needed · +${result.shardsGranted} 🔶`,
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
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
        include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
      });
      return {
        player: publicPlayer(player, config, true),
        claim: { id: result.claim.id, status: result.claim.status, slot: result.claim.slot },
        unlocks: result.unlocks ?? [],
        seedsGranted: result.seedsGranted ?? 0,
      };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  
  app.post("/api/player/notify-parent", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const now = new Date();
    try {
      const player = await prisma.player.findUniqueOrThrow({ where: { id: session.playerId } });
      const gate = parentNotifyGate(player.lastParentNotifyAt ?? null, now);
      if (!gate.allowed) {
        return reply.code(429).send({
          error: "You already nudged a grown-up. Try again later.",
          notifyParent: gate,
        });
      }
      const pendingCount = await prisma.choreClaim.count({
        where: { playerId: session.playerId, status: "PENDING" },
      });
      if (pendingCount <= 0) {
        return reply.code(400).send({ error: "Nothing is waiting on a grown-up right now." });
      }
      await prisma.player.update({
        where: { id: session.playerId },
        data: { lastParentNotifyAt: now },
      });
      void notifyApprovalsPending({
        playerName: player.name,
        pendingCount,
      }).catch((err) => request.log.warn({ err }, "parent notify push failed"));
      const nextGate = parentNotifyGate(now, now);
      return { ok: true, notifyParent: { allowed: false, retryAt: nextGate.retryAt, retryInMs: nextGate.retryInMs ?? PARENT_NOTIFY_COOLDOWN_MS } };
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

  
  app.get("/api/avatar/presets", async () => ({ presets: AVATAR_PRESETS }));

  app.post("/api/avatar", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    try {
      const body = validateAvatarBody(request.body);
      let data;
      if (body.kind === "mascot") {
        data = {
          avatarKind: "mascot",
          avatarPreset: null,
          avatarSelfieFile: null,
        };
      } else if (body.kind === "preset") {
        data = {
          avatarKind: "preset",
          avatarPreset: body.presetId!,
          avatarSelfieFile: null,
        };
      } else {
        const buf = decodeAndInspectAvatarImage(body.image);
        const saved = await writeAvatarSelfieJpeg({ buf, playerId: session.playerId });
        data = {
          avatarKind: "selfie",
          avatarPreset: null,
          avatarSelfieFile: saved.basename,
        };
      }
      const player = await prisma.player.update({
        where: { id: session.playerId },
        data,
        include: { plots: {
              orderBy: { slot: "asc" },
              include: {
                claimLinks: {
                  include: { claim: { include: { chore: true } } },
                },
              },
            }, basketItems: { where: { status: "held" }, orderBy: { createdAt: "asc" } } },
      });
      const config = await loadConfig();
      return { player: publicPlayer(player, config, true) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply.code(e.statusCode ?? 400).send({ error: e.message });
    }
  });

  app.get("/api/profile/avatar-selfie/:file", async (request, reply) => {
    const session = await requirePlayer(request, reply);
    if (!session) return;
    const file = decodeURIComponent((request.params as { file: string }).file);
    if (!isPlayerAvatarSelfieBasename(session.playerId, file)) {
      return reply.code(404).send({ error: "That photo isn't here." });
    }
    const full = avatarSelfieFilePath(file);
    try {
      await fsPromises.access(full, fsConstants.R_OK);
    } catch {
      return reply.code(404).send({ error: "That photo isn't here." });
    }
    reply.header("Content-Type", "image/jpeg");
    reply.header("Cache-Control", "private, max-age=120");
    return reply.send(createReadStream(full));
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

  /**
   * Lightweight player-app error reports. No secrets. Truncated. Soft rate limit.
   * Auth optional so boot/mount failures still land in API logs.
   */
  app.post("/api/client-errors", async (request, reply) => {
    const ip = request.ip || "unknown";
    const now = Date.now();
    const bucket = (globalThis as { __fhClientErr?: Map<string, number[]> }).__fhClientErr
      ?? ((globalThis as { __fhClientErr?: Map<string, number[]> }).__fhClientErr = new Map());
    const windowMs = 60_000;
    const maxPerWindow = 20;
    const hits = (bucket.get(ip) ?? []).filter((t: number) => now - t < windowMs);
    if (hits.length >= maxPerWindow) {
      return reply.code(429).send({ ok: false });
    }
    hits.push(now);
    bucket.set(ip, hits);

    const body = (request.body ?? {}) as {
      level?: string;
      tag?: string;
      message?: string;
      stack?: string;
      context?: unknown;
      href?: string;
      userAgent?: string;
      ts?: number;
    };
    const level = body.level === "warn" ? "warn" : "error";
    const tag = String(body.tag ?? "client").slice(0, 80);
    const message = String(body.message ?? "client error").slice(0, 500);
    const stack = typeof body.stack === "string" ? body.stack.split("\n").slice(0, 12).join("\n").slice(0, 2500) : undefined;
    const href = typeof body.href === "string" ? body.href.slice(0, 300) : undefined;
    const userAgent = typeof body.userAgent === "string" ? body.userAgent.slice(0, 300) : undefined;
    let context: unknown = undefined;
    try {
      context = body.context == null ? undefined : JSON.parse(JSON.stringify(body.context));
    } catch {
      context = undefined;
    }
    // No session DB lookup — keep this path cheap and rate-limit friendly.
    request.log[level](
      {
        clientError: true,
        tag,
        message,
        stack,
        href,
        userAgent,
        context,
        clientTs: typeof body.ts === "number" ? body.ts : undefined,
      },
      "player client error",
    );
    return { ok: true };
  });

}
