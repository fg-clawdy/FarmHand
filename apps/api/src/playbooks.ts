import {
  claimWindowLabel,
  claimWindowOpen,
  choreMinuteOfDay,
  MORNING_PLAYBOOK_SLUG,
} from "@farmhand/shared";
import type { Chore, ChorePlaybook, ChorePlaybookItem, Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { httpError, publicChore } from "./chores.js";
import { loadHeatByChoreId } from "./choreHeat.js";
import { loadConfig } from "./game.js";
import { slugifyTitle } from "./parentChoreWrite.js";

type PlaybookWithItems = ChorePlaybook & {
  items: Array<ChorePlaybookItem & { chore: Chore }>;
};

const playbookInclude = {
  items: { include: { chore: true }, orderBy: { sortOrder: "asc" as const } },
};

export type ParentPlaybook = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  windowStart: number | null;
  windowEnd: number | null;
  windowLabel: string | null;
  isActive: boolean;
  sortOrder: number;
  choreIds: string[];
  chores: Array<{ choreId: string; title: string; emoji: string; sortOrder: number }>;
};

export function serializeParentPlaybook(playbook: PlaybookWithItems): ParentPlaybook {
  const items = [...playbook.items].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: playbook.id,
    slug: playbook.slug,
    title: playbook.title,
    emoji: playbook.emoji,
    description: playbook.description,
    windowStart: playbook.windowStart,
    windowEnd: playbook.windowEnd,
    windowLabel: claimWindowLabel(playbook.windowStart, playbook.windowEnd),
    isActive: playbook.isActive,
    sortOrder: playbook.sortOrder,
    choreIds: items.map((item) => item.choreId),
    chores: items.map((item) => ({
      choreId: item.choreId,
      title: item.chore.title,
      emoji: item.chore.emoji,
      sortOrder: item.sortOrder,
    })),
  };
}

export type PlaybookBody = {
  title?: unknown;
  emoji?: unknown;
  description?: unknown;
  windowStart?: unknown;
  windowEnd?: unknown;
  isActive?: unknown;
  choreIds?: unknown;
};

function readString(value: unknown, label: string, opts?: { allowEmpty?: boolean }): string {
  if (typeof value !== "string") throw httpError(`Please enter a ${label}.`);
  const trimmed = value.trim();
  if (!trimmed && !opts?.allowEmpty) throw httpError(`Please enter a ${label}.`);
  return trimmed;
}

function readOptionalMinute(value: unknown, label: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 24 * 60) throw httpError(`Pick a valid ${label}.`);
  return n;
}

function readChoreIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !id)) {
    throw httpError("Pick the chores from the list.");
  }
  return [...new Set(value as string[])];
}

async function assertChoreIdsExist(ids: string[]) {
  if (ids.length === 0) return;
  const found = await prisma.chore.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (found.length !== ids.length) throw httpError("One of those chores isn't on the list.");
}

async function uniquePlaybookSlug(base: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (await prisma.chorePlaybook.findUnique({ where: { slug } })) {
    const suffix = `-${n}`;
    slug = `${base.slice(0, Math.max(1, 48 - suffix.length))}${suffix}`;
    n += 1;
  }
  return slug;
}

async function replacePlaybookItems(tx: Prisma.TransactionClient, playbookId: string, choreIds: string[]) {
  await tx.chorePlaybookItem.deleteMany({ where: { playbookId } });
  if (choreIds.length) {
    await tx.chorePlaybookItem.createMany({
      data: choreIds.map((choreId, sortOrder) => ({ playbookId, choreId, sortOrder })),
    });
  }
}

export async function listParentPlaybooks(): Promise<ParentPlaybook[]> {
  return (
    await prisma.chorePlaybook.findMany({ include: playbookInclude, orderBy: { sortOrder: "asc" } })
  ).map(serializeParentPlaybook);
}

export async function getParentPlaybook(id: string): Promise<ParentPlaybook> {
  const playbook = await prisma.chorePlaybook.findUnique({ where: { id }, include: playbookInclude });
  if (!playbook) throw httpError("That playbook isn't here.", 404);
  return serializeParentPlaybook(playbook);
}

export async function createParentPlaybook(body: PlaybookBody): Promise<ParentPlaybook> {
  const title = readString(body.title, "playbook title");
  const emoji = body.emoji === undefined ? "📋" : readString(body.emoji, "playbook emoji", { allowEmpty: true });
  const description = body.description === undefined ? "" : readString(body.description, "note", { allowEmpty: true });
  const windowStart = readOptionalMinute(body.windowStart, "broadcast-from time");
  const windowEnd = readOptionalMinute(body.windowEnd, "broadcast-until time");
  const isActive = body.isActive === undefined ? true : Boolean(body.isActive);
  const choreIds = readChoreIds(body.choreIds) ?? [];
  await assertChoreIdsExist(choreIds);
  const slug = await uniquePlaybookSlug(slugifyTitle(title));

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.chorePlaybook.create({
      data: {
        slug,
        title,
        emoji: emoji || "📋",
        description,
        windowStart: windowStart ?? null,
        windowEnd: windowEnd ?? null,
        isActive,
        sortOrder: (await tx.chorePlaybook.count()) + 1,
      },
    });
    await replacePlaybookItems(tx, row.id, choreIds);
    return tx.chorePlaybook.findUniqueOrThrow({ where: { id: row.id }, include: playbookInclude });
  });
  return serializeParentPlaybook(created);
}

export async function updateParentPlaybook(id: string, body: PlaybookBody): Promise<ParentPlaybook> {
  const existing = await prisma.chorePlaybook.findUnique({ where: { id }, include: playbookInclude });
  if (!existing) throw httpError("That playbook isn't here.", 404);
  const title = body.title === undefined ? existing.title : readString(body.title, "playbook title");
  const emoji =
    body.emoji === undefined ? existing.emoji : readString(body.emoji, "playbook emoji", { allowEmpty: true });
  const description =
    body.description === undefined ? existing.description : readString(body.description, "note", { allowEmpty: true });
  const windowStart = readOptionalMinute(body.windowStart, "broadcast-from time");
  const windowEnd = readOptionalMinute(body.windowEnd, "broadcast-until time");
  const isActive = body.isActive === undefined ? existing.isActive : Boolean(body.isActive);
  const choreIds = readChoreIds(body.choreIds);
  if (choreIds) await assertChoreIdsExist(choreIds);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.chorePlaybook.update({
      where: { id },
      data: {
        title,
        emoji: emoji || "📋",
        description,
        ...(windowStart !== undefined ? { windowStart } : {}),
        ...(windowEnd !== undefined ? { windowEnd } : {}),
        isActive,
      },
    });
    if (choreIds) await replacePlaybookItems(tx, id, choreIds);
    return tx.chorePlaybook.findUniqueOrThrow({ where: { id }, include: playbookInclude });
  });
  return serializeParentPlaybook(updated);
}

export async function deleteParentPlaybook(id: string): Promise<void> {
  const existing = await prisma.chorePlaybook.findUnique({ where: { id } });
  if (!existing) throw httpError("That playbook isn't here.", 404);
  await prisma.chorePlaybook.delete({ where: { id } });
}

export type PlayerPlaybookView = {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  windowLabel: string | null;
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  items: Array<{ chore: ReturnType<typeof publicChore>; claimed: boolean }>;
};

/** Active, currently-broadcasting playbooks with per-item claim status for this kid. */
export async function buildPlaybookView(
  playerId: string,
  timezone: string,
  now = new Date(),
): Promise<PlayerPlaybookView[]> {
  const [playbooks, claims, raceSlots, heatByChoreId, config] = await Promise.all([
    prisma.chorePlaybook.findMany({
      where: { isActive: true },
      include: {
        items: { include: { chore: { include: { assignments: true } } }, orderBy: { sortOrder: "asc" } },
      },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.choreClaim.findMany({ where: { playerId }, select: { choreId: true, periodKey: true } }),
    prisma.choreRaceSlot.findMany({ select: { choreId: true, periodKey: true } }),
    loadHeatByChoreId(),
    loadConfig(),
  ]);
  const claimedPeriodKeys = new Set(claims.map((row) => `${row.choreId}:${row.periodKey}`));
  const raceTakenKeys = new Set(raceSlots.map((row) => `${row.choreId}:${row.periodKey}`));
  const minute = choreMinuteOfDay(now, timezone);
  const views: PlayerPlaybookView[] = [];
  for (const playbook of playbooks) {
    if (!claimWindowOpen(playbook.windowStart, playbook.windowEnd, minute)) continue;
    const items = playbook.items.map((item) => {
      const chore = publicChore(item.chore, {
        playerId,
        timezone,
        now,
        claimedPeriodKeys,
        raceTakenKeys,
        heatByChoreId,
        config,
      });
      return { chore, claimed: chore.claimed };
    });
    const completedCount = items.filter((item) => item.claimed).length;
    views.push({
      id: playbook.id,
      slug: playbook.slug,
      title: playbook.title,
      emoji: playbook.emoji,
      description: playbook.description,
      windowLabel: claimWindowLabel(playbook.windowStart, playbook.windowEnd),
      completedCount,
      totalCount: items.length,
      allDone: items.length > 0 && completedCount === items.length,
      items,
    });
  }
  return views;
}

/**
 * Seed the opt-in Morning and Bedtime playbooks (inactive until a parent turns
 * them on). Chores are looked up by catalog slug so the seed is idempotent.
 */
export async function seedPlaybooks() {
  const morningChores = await prisma.chore.findMany({
    where: { slug: { in: ["make-your-bed", "brush-teeth-am", "brush-your-hair"] } },
    orderBy: { sortOrder: "asc" },
  });
  const bedtimeChores = await prisma.chore.findMany({
    where: { slug: { in: ["brush-teeth-bedtime", "set-out-school-clothes", "easy-bedtime"] } },
    orderBy: { sortOrder: "asc" },
  });

  async function ensure(
    slug: string,
    title: string,
    emoji: string,
    description: string,
    window: { start: number; end: number },
    chores: Chore[],
  ) {
    const choreIds = chores.map((c) => c.id);
    const existing = await prisma.chorePlaybook.findUnique({ where: { slug } });
    // Seed is create-only: never overwrite a parent's edits on reboot.
    if (existing) return;
    await prisma.$transaction(async (tx) => {
      const row = await tx.chorePlaybook.create({
        data: {
          slug,
          title,
          emoji,
          description,
          windowStart: window.start,
          windowEnd: window.end,
          isActive: false,
          sortOrder: (await tx.chorePlaybook.count()) + 1,
        },
      });
      await replacePlaybookItems(tx, row.id, choreIds);
    });
  }

  await ensure(
    MORNING_PLAYBOOK_SLUG,
    "Morning Routine",
    "🌅",
    "Get ready for the day.",
    { start: 5 * 60, end: 11 * 60 },
    morningChores,
  );
  await ensure(
    "bedtime",
    "Bedtime Routine",
    "🌙",
    "Wind down for a good night.",
    { start: 17 * 60, end: 22 * 60 },
    bedtimeChores,
  );
}



