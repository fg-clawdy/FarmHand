import { compareChoresForParent, DEFAULT_GAME_CONFIG, formatWantedSeedLabel, resolveSeedReward, type GameConfig } from "@farmhand/shared";
import { Prisma, type Chore, type ChoreAssignment, type Player } from "@prisma/client";
import { prisma } from "./db.js";
import { httpError } from "./chores.js";
import { loadConfig } from "./game.js";
import {
  isGlobalForMode,
  parseParentChoreWrite,
  slugifyTitle,
  type ParentChoreBody,
} from "./parentChoreWrite.js";
import { generateWantedFlyer, wantedFlyerPublicUrl } from "./wantedFlyer.js";

const choreInclude = {
  assignments: { include: { player: true }, orderBy: { createdAt: "asc" as const } },
};

type ChoreWithKids = Chore & {
  assignments: Array<ChoreAssignment & { player: Player }>;
};

export function serializeParentChore(chore: ChoreWithKids, config = DEFAULT_GAME_CONFIG) {
  const assignments = chore.assignments.map((row) => ({
    playerId: row.playerId,
    name: row.player.name,
  }));
  return {
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
    assignmentMode: chore.assignmentMode,
    sortOrder: chore.sortOrder,
    difficulty: chore.difficulty,
    seedReward: chore.seedReward,
    seedGrant: resolveSeedReward(chore, config),
    flyerUrl: wantedFlyerPublicUrl(chore.slug),
    assignments,
    assignedPlayerIds: assignments.map((row) => row.playerId),
  };
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (await prisma.chore.findUnique({ where: { slug } })) {
    const suffix = `-${n}`;
    slug = `${base.slice(0, Math.max(1, 48 - suffix.length))}${suffix}`;
    n += 1;
  }
  return slug;
}

async function assertAssignedKids(ids: string[]) {
  if (ids.length === 0) throw httpError("Pick at least one kid for this chore.");
  const kids = await prisma.player.findMany({
    where: { id: { in: ids }, isActive: true },
    select: { id: true },
  });
  if (kids.length !== ids.length) throw httpError("That kid isn't on the farm.");
}

export async function listParentChores() {
  const [chores, config] = await Promise.all([
    prisma.chore.findMany({ include: choreInclude }),
    loadConfig(),
  ]);
  return chores.sort(compareChoresForParent).map((chore) => serializeParentChore(chore, config));
}

export async function getParentChore(id: string) {
  const [chore, config] = await Promise.all([
    prisma.chore.findUnique({ where: { id }, include: choreInclude }),
    loadConfig(),
  ]);
  if (!chore) throw httpError("That chore isn't on the list.", 404);
  return serializeParentChore(chore, config);
}

export async function createParentChore(body: ParentChoreBody) {
  const parsed = parseParentChoreWrite(body, "create");
  const assignmentMode = parsed.assignmentMode ?? "ALL";
  const assignedPlayerIds = parsed.assignedPlayerIds ?? [];
  if (assignmentMode === "SPECIFIC") await assertAssignedKids(assignedPlayerIds);
  const maxOrder = await prisma.chore.aggregate({ _max: { sortOrder: true } });
  const slug = await uniqueSlug(slugifyTitle(parsed.title ?? "chore"));
  const config = await loadConfig();
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.chore.create({
      data: {
        slug,
        title: parsed.title ?? "Chore",
        emoji: parsed.emoji ?? "⭐",
        description: parsed.description ?? "",
        recurrence: parsed.recurrence ?? "DAILY",
        timeOfDay: parsed.timeOfDay ?? "ANYTIME",
        priority: parsed.priority ?? "NORMAL",
        estimatedMinutes: parsed.estimatedMinutes ?? null,
        requiresApproval: parsed.requiresApproval ?? true,
        requiresSelfie: parsed.requiresSelfie ?? false,
        allowsSkip: parsed.allowsSkip ?? false,
        isGlobal: isGlobalForMode(assignmentMode),
        includeInPath: parsed.includeInPath ?? true,
        isActive: parsed.isActive ?? true,
        assignmentMode,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
    if (assignmentMode === "SPECIFIC") {
      await tx.choreAssignment.createMany({
        data: assignedPlayerIds.map((playerId) => ({ choreId: row.id, playerId })),
      });
    }
    return tx.chore.findUniqueOrThrow({ where: { id: row.id }, include: choreInclude });
  });
  await generateWantedFlyer({
    slug: created.slug,
    title: created.title,
    emoji: created.emoji,
    rewardLabel: formatWantedSeedLabel(resolveSeedReward(created, config)),
  });
  return serializeParentChore(created, config);
}

export async function updateParentChore(id: string, body: ParentChoreBody) {
  const existing = await prisma.chore.findUnique({ where: { id }, include: choreInclude });
  if (!existing) throw httpError("That chore isn't on the list.", 404);
  const parsed = parseParentChoreWrite(body, "patch");
  const assignmentMode = parsed.assignmentMode ?? existing.assignmentMode;
  let assignedPlayerIds = parsed.assignedPlayerIds;
  if (assignmentMode === "SPECIFIC") {
    if (assignedPlayerIds === undefined) {
      assignedPlayerIds = existing.assignments.map((row) => row.playerId);
    }
    await assertAssignedKids(assignedPlayerIds);
  } else {
    assignedPlayerIds = [];
  }
  const data: Prisma.ChoreUpdateInput = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.emoji !== undefined) data.emoji = parsed.emoji;
  if (parsed.description !== undefined) data.description = parsed.description;
  if (parsed.recurrence !== undefined) data.recurrence = parsed.recurrence;
  if (parsed.timeOfDay !== undefined) data.timeOfDay = parsed.timeOfDay;
  if (parsed.priority !== undefined) data.priority = parsed.priority;
  if (parsed.estimatedMinutes !== undefined) data.estimatedMinutes = parsed.estimatedMinutes;
  if (parsed.requiresApproval !== undefined) data.requiresApproval = parsed.requiresApproval;
  if (parsed.requiresSelfie !== undefined) data.requiresSelfie = parsed.requiresSelfie;
  if (parsed.allowsSkip !== undefined) data.allowsSkip = parsed.allowsSkip;
  if (parsed.includeInPath !== undefined) data.includeInPath = parsed.includeInPath;
  if (parsed.isActive !== undefined) data.isActive = parsed.isActive;
  data.assignmentMode = assignmentMode;
  data.isGlobal = isGlobalForMode(assignmentMode);

  const config = await loadConfig();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.chore.update({ where: { id }, data });
    if (parsed.assignmentMode !== undefined || parsed.assignedPlayerIds !== undefined) {
      await tx.choreAssignment.deleteMany({ where: { choreId: id } });
      if (assignmentMode === "SPECIFIC" && assignedPlayerIds.length) {
        await tx.choreAssignment.createMany({
          data: assignedPlayerIds.map((playerId) => ({ choreId: id, playerId })),
        });
      }
    }
    return tx.chore.findUniqueOrThrow({ where: { id }, include: choreInclude });
  });
  await generateWantedFlyer({
    slug: updated.slug,
    title: updated.title,
    emoji: updated.emoji,
    rewardLabel: formatWantedSeedLabel(resolveSeedReward(updated, config)),
  });
  return serializeParentChore(updated, config);
}

export async function listParentKids() {
  return prisma.player.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, mascot: true },
  });
}
