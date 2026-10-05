import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { httpError } from "./chores.js";
import { appendStarEvent, playerWallet } from "./stars.js";
import { withSerializableRetry, withLockedPlayer } from "./locks.js";
import {
  DEFAULT_GIVE_CEILING,
  PUT_BACK_WINDOW_SECONDS,
  buildJarArtPrompt,
  tintIndexFor,
  type PublicSharedGoal,
  type ParentSharedGoal,
  type ParentGoalContribution,
  type SharedGoalArtStatus,
} from "@farmhand/shared";
import { enqueueJarArt, planJarArt } from "./jarArt.js";

type Tx = Prisma.TransactionClient;

// ---- Public shapes ----

export function publicSharedGoal(row: {
  id: string;
  title: string;
  emoji: string;
  targetStars: number;
  status: string;
  tintIndex?: number;
  artUrl?: string | null;
  artStatus?: string;
  _fill?: number;
}): PublicSharedGoal {
  const fill = row._fill ?? 0;
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji,
    targetStars: row.targetStars,
    filledStars: Math.min(fill, row.targetStars),
    status: row.status as PublicSharedGoal["status"],
    tintIndex: row.tintIndex ?? 0,
    artUrl: row.artUrl ?? null,
    artStatus: (row.artStatus ?? "DEFAULT") as SharedGoalArtStatus,
  };
}

function clipNotes(notes: string | undefined): string | null {
  const trimmed = notes?.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

async function goalFill(goalId: string, tx: Tx = prisma): Promise<number> {
  const [give, ret] = await Promise.all([
    tx.sharedGoalEvent.aggregate({
      where: { goalId, kind: "GIVE" },
      _sum: { amount: true },
    }),
    tx.sharedGoalEvent.aggregate({
      where: { goalId, kind: "RETURN" },
      _sum: { amount: true },
    }),
  ]);
  return (give._sum.amount ?? 0) - (ret._sum.amount ?? 0);
}

// ---- Invariant guards ----

async function assertWaitingCountUnderLimit(tx: Tx) {
  const count = await tx.sharedGoal.count({ where: { status: "WAITING" } });
  if (count >= 3) {
    throw httpError("Finish or remove one first.", 409);
  }
}

// ---- Parent operations ----

export async function createSharedGoal(opts: {
  title: string;
  emoji: string;
  targetStars: number;
  artNotes?: string;
  /** Background lid paint. Default pastel art is saved either way. */
  generateArt?: boolean;
  /** Park on the parent Later list instead of the farm tray. */
  queue?: boolean;
}) {
  const title = opts.title.trim();
  const emoji = opts.emoji.trim();
  if (!title) throw httpError("Please give the jar a name.");
  if (!emoji) throw httpError("Please pick an emoji.");
  if (!Number.isInteger(opts.targetStars) || opts.targetStars < 1) {
    throw httpError("Target should be a whole number of stars, at least 1.");
  }

  const artNotes = clipNotes(opts.artNotes);
  const artPrompt = buildJarArtPrompt({ title, emoji, notes: artNotes });
  const generateArt = opts.generateArt === true;
  const queue = opts.queue === true;
  const artPlan = planJarArt({ requested: generateArt, previousUrl: null, phase: "create" });

  const created = await withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const prior = await tx.sharedGoal.count();
      const tintIndex = tintIndexFor(title, prior);
      const art = {
        tintIndex,
        artNotes,
        artPrompt,
        artStatus: artPlan.artStatus,
        artUrl: null as string | null,
      };

      if (queue) {
        await assertWaitingCountUnderLimit(tx);
        const maxSort = await tx.sharedGoal.aggregate({
          where: { status: "WAITING" },
          _max: { sortOrder: true },
        });
        const row = await tx.sharedGoal.create({
          data: {
            title,
            emoji,
            targetStars: opts.targetStars,
            status: "WAITING",
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
            ...art,
          },
        });
        return publicSharedGoal({ ...row, _fill: 0 });
      }

      const row = await tx.sharedGoal.create({
        data: {
          title,
          emoji,
          targetStars: opts.targetStars,
          status: "OPEN",
          ...art,
        },
      });
      return publicSharedGoal({ ...row, _fill: 0 });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );

  if (generateArt) enqueueJarArt(created.id);
  return { goal: created };
}

export async function openSharedGoal(goalId: string) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const goal = await tx.sharedGoal.findUniqueOrThrow({ where: { id: goalId } });
      if (goal.status !== "WAITING") {
        throw httpError("Only a waiting reward can be opened.", 409);
      }
      return tx.sharedGoal.update({
        where: { id: goalId },
        data: { status: "OPEN" },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );
}

export async function removeWaitingGoal(goalId: string) {
  const goal = await prisma.sharedGoal.findUniqueOrThrow({ where: { id: goalId } });
  if (goal.status !== "WAITING") {
    throw httpError("Only a waiting reward can be removed. Put away an open jar instead.", 409);
  }
  await prisma.sharedGoal.delete({ where: { id: goalId } });
  return { ok: true };
}

export async function happenSharedGoal(goalId: string) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const goal = await tx.sharedGoal.findUniqueOrThrow({ where: { id: goalId } });
      if (goal.status !== "READY") {
        throw httpError("The jar isn't ready yet. Lower the target if you want to finish early.", 409);
      }
      return tx.sharedGoal.update({
        where: { id: goalId },
        data: { status: "HAPPENED", happenedAt: new Date() },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );
}

export async function cancelSharedGoal(goalId: string) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const goal = await tx.sharedGoal.findUniqueOrThrow({ where: { id: goalId } });
      if (goal.status !== "OPEN" && goal.status !== "READY") {
        throw httpError("Only an open or ready jar can be put away.", 409);
      }

      const events = await tx.sharedGoalEvent.findMany({
        where: { goalId },
        orderBy: { createdAt: "asc" },
      });

      const netByPlayer = new Map<string, number>();
      for (const ev of events) {
        const current = netByPlayer.get(ev.playerId) ?? 0;
        if (ev.kind === "GIVE") netByPlayer.set(ev.playerId, current + ev.amount);
        else if (ev.kind === "RETURN") netByPlayer.set(ev.playerId, current - ev.amount);
      }

      for (const [playerId, net] of netByPlayer) {
        if (net <= 0) continue;
        const player = await tx.player.findUnique({ where: { id: playerId } });
        if (!player) continue;

        const idempotencyKey = `cancel:return:${goalId}:${playerId}`;
        const existing = await tx.sharedGoalEvent.findUnique({
          where: { idempotencyKey },
        });
        if (existing) continue; // Already returned — idempotent

        await appendStarEvent(tx, {
          playerId,
          kind: "RETURN_SHARED",
          amount: net,
          idempotencyKey,
          source: "shared_goal_cancel",
        });
        await tx.player.update({
          where: { id: playerId },
          data: { points: { increment: net } },
        });
        await tx.sharedGoalEvent.create({
          data: {
            goalId,
            playerId,
            kind: "RETURN",
            amount: net,
            idempotencyKey,
          },
        });
      }

      return tx.sharedGoal.update({
        where: { id: goalId },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20_000 }),
  );
}

export async function patchSharedGoal(
  goalId: string,
  patch: { title?: string; emoji?: string; targetStars?: number; sortOrder?: number },
) {
  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const goal = await tx.sharedGoal.findUniqueOrThrow({ where: { id: goalId } });
      const fill = await goalFill(goalId, tx);
      const data: Record<string, unknown> = {};

      if (patch.title !== undefined || patch.emoji !== undefined) {
        if (fill > 0 && goal.status !== "WAITING") {
          throw httpError("Cannot rename a jar that already has stars. Put it away and create a new one.", 409);
        }
        if (patch.title !== undefined) data.title = patch.title.trim();
        if (patch.emoji !== undefined) data.emoji = patch.emoji.trim();
      }

      if (patch.targetStars !== undefined) {
        if (!Number.isInteger(patch.targetStars) || patch.targetStars < 1) {
          throw httpError("Target should be a whole number of stars, at least 1.");
        }
        data.targetStars = patch.targetStars;
        if (goal.status === "OPEN" && patch.targetStars <= fill) {
          data.status = "READY";
          data.readyAt = new Date();
        }
      }

      if (patch.sortOrder !== undefined && goal.status === "WAITING") {
        data.sortOrder = patch.sortOrder;
      }

      if (Object.keys(data).length === 0) return goal;
      return tx.sharedGoal.update({ where: { id: goalId }, data });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );
}

export async function updateSharedGoalArt(
  goalId: string,
  patch: { artPrompt?: string; artNotes?: string; regenerate?: boolean },
) {
  const goal = await prisma.sharedGoal.findUnique({ where: { id: goalId } });
  if (!goal) throw httpError("That jar isn't here.", 404);
  if (goal.status === "HAPPENED" || goal.status === "CANCELLED") {
    throw httpError("That jar is already put away.", 409);
  }

  const data: {
    artPrompt?: string;
    artNotes?: string | null;
    artStatus?: SharedGoalArtStatus;
  } = {};
  if (patch.artPrompt !== undefined) {
    const prompt = patch.artPrompt.trim();
    if (!prompt) throw httpError("Write a prompt for the lid.");
    if (prompt.length > 1500) throw httpError("That prompt is too long.");
    data.artPrompt = prompt;
  }
  if (patch.artNotes !== undefined) data.artNotes = clipNotes(patch.artNotes);
  if (patch.regenerate) data.artStatus = "QUEUED";
  if (!Object.keys(data).length) throw httpError("Nothing to change.");

  await prisma.sharedGoal.update({ where: { id: goalId }, data });
  if (patch.regenerate) enqueueJarArt(goalId);
  return { ok: true as const };
}

export async function regenerateSharedGoalArt(goalId: string) {
  const goal = await prisma.sharedGoal.findUnique({ where: { id: goalId } });
  if (!goal) throw httpError("That jar isn't here.", 404);
  if (goal.status === "HAPPENED" || goal.status === "CANCELLED") {
    throw httpError("That jar is already put away.", 409);
  }
  const artPrompt =
    goal.artPrompt?.trim() ||
    buildJarArtPrompt({ title: goal.title, emoji: goal.emoji, notes: goal.artNotes });
  await prisma.sharedGoal.update({
    where: { id: goalId },
    data: { artPrompt, artStatus: "QUEUED" },
  });
  enqueueJarArt(goalId);
  return { ok: true as const };
}


// ---- Player pour ----

export async function pourSharedGoal(opts: {
  playerId: string;
  goalId: string;
  amount: number;
  requestId: string;
}) {
  const { playerId, goalId, amount, requestId } = opts;

  if (!Number.isInteger(amount) || amount < 1) {
    throw httpError("Please pick a number of stars to add.");
  }

  const idempotencyKey = `give:${goalId}:${playerId}:${requestId}`;

  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        `SELECT id FROM "Player" WHERE id = $1 FOR UPDATE`,
        playerId,
      );
      await tx.$queryRawUnsafe(
        `SELECT id FROM "SharedGoal" WHERE id = $1 FOR UPDATE`,
        goalId,
      );

      const existingGive = await tx.sharedGoalEvent.findUnique({
        where: { idempotencyKey },
      });
      if (existingGive?.kind === "GIVE" && existingGive.playerId === playerId) {
        const current = await tx.sharedGoal.findUniqueOrThrow({ where: { id: goalId } });
        const fillNow = await goalFill(goalId, tx);
        const walletNow = await playerWallet(playerId, tx);
        return {
          availableStars: walletNow.availableStars,
          currentStars: walletNow.currentStars,
          filledStars: Math.min(fillNow, current.targetStars),
          status: current.status,
          targetStars: current.targetStars,
          title: current.title,
          giveKey: idempotencyKey,
          amount: existingGive.amount,
        };
      }

      const goal = await tx.sharedGoal.findUniqueOrThrow({ where: { id: goalId } });
      if (goal.status !== "OPEN") {
        throw httpError("This jar isn't taking stars right now.", 409);
      }

      const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
      if (player.givingEnabled === false) {
        throw httpError("You can watch the jar fill.", 403);
      }
      const giveCeiling = player.giveCeiling ?? DEFAULT_GIVE_CEILING;

      const fill = await goalFill(goalId, tx);
      const room = Math.max(0, goal.targetStars - fill);
      if (room <= 0) {
        throw httpError("The jar is full.", 409);
      }

      const clampedAmount = Math.min(amount, room);
      if (clampedAmount <= 0) {
        throw httpError("Room for 0 more.", 409);
      }

      if (clampedAmount > giveCeiling) {
        throw httpError(`You can add up to ${giveCeiling} stars at a time.`, 409);
      }

      const walletNow = await playerWallet(playerId, tx);
      if (walletNow.availableStars < clampedAmount) {
        throw httpError("Not enough stars to add.", 409);
      }

      await tx.player.update({
        where: { id: playerId },
        data: { points: { decrement: clampedAmount } },
      });

      await appendStarEvent(tx, {
        playerId,
        kind: "GIVE_SHARED",
        amount: clampedAmount,
        idempotencyKey,
        source: "shared_goal_pour",
      });

      await tx.sharedGoalEvent.create({
        data: {
          goalId,
          playerId,
          kind: "GIVE",
          amount: clampedAmount,
          idempotencyKey,
        },
      });

      const newFill = fill + clampedAmount;
      const newStatus = newFill >= goal.targetStars ? "READY" : "OPEN";
      if (newStatus === "READY") {
        await tx.sharedGoal.update({
          where: { id: goalId },
          data: { status: "READY", readyAt: new Date() },
        });
      }

      const newWallet = await playerWallet(playerId, tx);

      return {
        availableStars: newWallet.availableStars,
        currentStars: newWallet.currentStars,
        filledStars: Math.min(newFill, goal.targetStars),
        status: newStatus,
        targetStars: goal.targetStars,
        title: goal.title,
        giveKey: idempotencyKey,
        amount: clampedAmount,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );
}


// ---- Mis-tap put-back ----

export async function putBackSharedGoal(opts: {
  playerId: string;
  goalId: string;
  giveKey: string;
}) {
  const { playerId, goalId, giveKey } = opts;

  const parts = giveKey.split(":");
  if (parts.length < 4 || parts[0] !== "give") {
    throw httpError("Invalid put-back key.", 400);
  }

  return withSerializableRetry(() =>
    prisma.$transaction(async (tx) => {
      const giveEvent = await tx.sharedGoalEvent.findUnique({
        where: { idempotencyKey: giveKey },
      });
      if (!giveEvent || giveEvent.kind !== "GIVE") {
        throw httpError("Nothing to put back.", 404);
      }
      if (giveEvent.playerId !== playerId) {
        throw httpError("You can only put back your own stars.", 403);
      }

      const elapsed = Date.now() - giveEvent.createdAt.getTime();
      if (elapsed > PUT_BACK_WINDOW_SECONDS * 1000) {
        throw httpError("Too late to put those stars back.", 409);
      }

      const putbackKey = `putback:${giveKey}`;
      const existingReturn = await tx.sharedGoalEvent.findUnique({
        where: { idempotencyKey: putbackKey },
      });
      if (existingReturn) {
        const goal = await tx.sharedGoal.findUniqueOrThrow({ where: { id: goalId } });
        const fill = await goalFill(goalId, tx);
        const wallet = await playerWallet(playerId, tx);
        return {
          availableStars: wallet.availableStars,
          currentStars: wallet.currentStars,
          filledStars: Math.min(fill, goal.targetStars),
          status: goal.status,
          targetStars: goal.targetStars,
          title: goal.title,
        };
      }

      const goal = await tx.sharedGoal.findUniqueOrThrow({ where: { id: goalId } });
      const amount = giveEvent.amount;

      await tx.player.update({
        where: { id: playerId },
        data: { points: { increment: amount } },
      });

      await appendStarEvent(tx, {
        playerId,
        kind: "RETURN_SHARED",
        amount,
        idempotencyKey: putbackKey,
        source: "shared_goal_putback",
      });

      await tx.sharedGoalEvent.create({
        data: { goalId, playerId, kind: "RETURN", amount, idempotencyKey: putbackKey },
      });

      const newFill = await goalFill(goalId, tx);
      let newStatus = goal.status;
      if (goal.status === "READY" && newFill < goal.targetStars) {
        newStatus = "OPEN";
        await tx.sharedGoal.update({
          where: { id: goalId },
          data: { status: "OPEN", readyAt: null },
        });
      }

      const wallet = await playerWallet(playerId, tx);
      return {
        availableStars: wallet.availableStars,
        currentStars: wallet.currentStars,
        filledStars: Math.min(newFill, goal.targetStars),
        status: newStatus,
        targetStars: goal.targetStars,
        title: goal.title,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 12_000 }),
  );
}

// ---- Farm / kid reads ----

export async function activeSharedGoals(): Promise<PublicSharedGoal[]> {
  const goals = await prisma.sharedGoal.findMany({
    where: { status: { in: ["OPEN", "READY"] } },
    orderBy: { createdAt: "asc" },
  });
  return Promise.all(
    goals.map(async (goal) => {
      const fill = await goalFill(goal.id);
      return publicSharedGoal({ ...goal, _fill: fill });
    }),
  );
}

export async function activeSharedGoal(): Promise<PublicSharedGoal | null> {
  const jars = await activeSharedGoals();
  return jars[0] ?? null;
}

export async function getSharedGoal(goalId: string): Promise<PublicSharedGoal | null> {
  const goal = await prisma.sharedGoal.findUnique({ where: { id: goalId } });
  if (!goal || goal.status === "WAITING") return null;
  const fill = await goalFill(goalId);
  return publicSharedGoal({ ...goal, _fill: fill });
}

// ---- Parent reads ----

export async function parentSharedGoals(): Promise<{
  active: ParentSharedGoal | null;
  activeGoals: ParentSharedGoal[];
  waiting: ParentSharedGoal[];
  history: ParentSharedGoal[];
  players: ParentGoalContribution[];
}> {
  const [activeGoals, waitingGoals, pastGoals, players] = await Promise.all([
    prisma.sharedGoal.findMany({
      where: { status: { in: ["OPEN", "READY"] } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.sharedGoal.findMany({
      where: { status: "WAITING" },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.sharedGoal.findMany({
      where: { status: { in: ["HAPPENED", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.player.findMany({
      where: { isActive: true },
      select: { id: true, name: true, mascot: true, givingEnabled: true, giveCeiling: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  async function toParentGoal(
    goal: (typeof activeGoals)[number] | null,
  ): Promise<ParentSharedGoal | null> {
    if (!goal) return null;
    const fill = await goalFill(goal.id);

    const allEvents = await prisma.sharedGoalEvent.findMany({
      where: { goalId: goal.id },
      select: { playerId: true, kind: true, amount: true },
    });

    const giveMap = new Map<string, number>();
    const returnMap = new Map<string, number>();
    for (const ev of allEvents) {
      if (ev.kind === "GIVE") {
        giveMap.set(ev.playerId, (giveMap.get(ev.playerId) ?? 0) + ev.amount);
      } else {
        returnMap.set(ev.playerId, (returnMap.get(ev.playerId) ?? 0) + ev.amount);
      }
    }

    const contributions: ParentGoalContribution[] = players.map((p) => {
      const net = (giveMap.get(p.id) ?? 0) - (returnMap.get(p.id) ?? 0);
      return {
        playerId: p.id,
        playerName: p.name,
        mascot: p.mascot,
        netGiven: net,
        givingEnabled: p.givingEnabled !== false,
        giveCeiling: p.giveCeiling ?? DEFAULT_GIVE_CEILING,
      };
    });

    return {
      id: goal.id,
      title: goal.title,
      emoji: goal.emoji,
      targetStars: goal.targetStars,
      filledStars: Math.min(fill, goal.targetStars),
      status: goal.status as ParentSharedGoal["status"],
      sortOrder: goal.sortOrder,
      createdAt: goal.createdAt.toISOString(),
      readyAt: goal.readyAt?.toISOString() ?? null,
      happenedAt: goal.happenedAt?.toISOString() ?? null,
      cancelledAt: goal.cancelledAt?.toISOString() ?? null,
      contributions,
      usdTarget: (goal.targetStars / 100).toFixed(2),
      usdFilled: (Math.min(fill, goal.targetStars) / 100).toFixed(2),
      tintIndex: goal.tintIndex,
      artUrl: goal.artUrl,
      artStatus: goal.artStatus,
      artPrompt: goal.artPrompt,
      artNotes: goal.artNotes,
    };
  }

  const playerContributions: ParentGoalContribution[] = players.map((p) => ({
    playerId: p.id,
    playerName: p.name,
    mascot: p.mascot,
    netGiven: 0,
    givingEnabled: p.givingEnabled !== false,
    giveCeiling: p.giveCeiling ?? DEFAULT_GIVE_CEILING,
  }));

  const onFarm = (
    await Promise.all(activeGoals.map((goal) => toParentGoal(goal)))
  ).filter((goal): goal is ParentSharedGoal => goal != null);

  return {
    active: onFarm[0] ?? null,
    activeGoals: onFarm,
    waiting: (
      await Promise.all(waitingGoals.map((goal) => toParentGoal(goal)))
    ).filter((goal): goal is ParentSharedGoal => goal != null),
    history: (
      await Promise.all(pastGoals.map((g) => toParentGoal(g)))
    ).filter((g): g is ParentSharedGoal => g != null),
    players: playerContributions,
  };
}

export async function markFamilyJarCoachSeen(playerId: string) {
  await prisma.player.update({
    where: { id: playerId },
    data: { familyJarCoachSeenAt: new Date() },
  });
  return { ok: true as const, familyJarCoach: false };
}

export async function patchPlayerGiving(
  playerId: string,
  patch: { givingEnabled?: boolean; giveCeiling?: number },
) {
  const data: { givingEnabled?: boolean; giveCeiling?: number } = {};
  if (typeof patch.givingEnabled === "boolean") data.givingEnabled = patch.givingEnabled;
  if (patch.giveCeiling !== undefined) {
    if (!Number.isInteger(patch.giveCeiling) || patch.giveCeiling < 1) {
      throw httpError("Ceiling should be a whole number of stars, at least 1.");
    }
    data.giveCeiling = patch.giveCeiling;
  }
  if (!Object.keys(data).length) throw httpError("Nothing to change.");
  const player = await prisma.player.update({
    where: { id: playerId },
    data,
    select: { id: true, name: true, givingEnabled: true, giveCeiling: true },
  });
  return { player };
}

