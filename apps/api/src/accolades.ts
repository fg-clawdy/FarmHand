import {
  evaluateUnlocks,
  LIFETIME_LEGENDS,
  LIFETIME_SEASON_KEY,
  medalsEarned,
  nextStep,
  seasonLabel,
  SEASONAL_TRACKS,
  unlockKey,
  type AccoladeCounters,
  type AccoladeMedal,
} from "@farmhand/shared";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { seasonKey, todayKey } from "./tz.js";

type Tx = Prisma.TransactionClient;

export type AccoladeEvent =
  | { type: "harvest"; cropKind: "corn" | "strawberry" | "cotton" }
  | { type: "watering" }
  | { type: "planting" }
  | { type: "selfie" }
  | { type: "chore_photo" };

const emptyCounters = {
  harvests: 0,
  waterings: 0,
  plantings: 0,
  selfies: 0,
  chorePhotos: 0,
  cropsMask: 0,
};

function cropBit(kind: "corn" | "strawberry" | "cotton"): number {
  if (kind === "corn") return 1;
  if (kind === "strawberry") return 2;
  return 4;
}

export function publicUnlock(row: {
  slug: string;
  kind: string;
  seasonKey: string;
  medal: string;
  title: string;
  emoji: string;
  blurb: string;
  unlockedAt: Date;
}) {
  return {
    slug: row.slug,
    kind: row.kind as "seasonal" | "lifetime",
    seasonKey: row.kind === "lifetime" ? null : row.seasonKey,
    medal: (row.medal || null) as AccoladeMedal | null,
    title: row.title,
    emoji: row.emoji,
    blurb: row.blurb,
    unlockedAt: row.unlockedAt.toISOString(),
  };
}

async function bump(tx: Tx, playerId: string, seasonKeyValue: string, event: AccoladeEvent) {
  const existing = await tx.accoladeCounter.findUnique({
    where: { playerId_seasonKey: { playerId, seasonKey: seasonKeyValue } },
  });
  const bit = event.type === "harvest" ? cropBit(event.cropKind) : 0;
  const inc = {
    harvests: event.type === "harvest" ? 1 : 0,
    waterings: event.type === "watering" ? 1 : 0,
    plantings: event.type === "planting" ? 1 : 0,
    selfies: event.type === "selfie" ? 1 : 0,
    chorePhotos: event.type === "chore_photo" ? 1 : 0,
  };
  if (!existing) {
    return tx.accoladeCounter.create({
      data: {
        playerId,
        seasonKey: seasonKeyValue,
        harvests: inc.harvests,
        waterings: inc.waterings,
        plantings: inc.plantings,
        selfies: inc.selfies,
        chorePhotos: inc.chorePhotos,
        cropsMask: bit,
      },
    });
  }
  return tx.accoladeCounter.update({
    where: { id: existing.id },
    data: {
      harvests: { increment: inc.harvests },
      waterings: { increment: inc.waterings },
      plantings: { increment: inc.plantings },
      selfies: { increment: inc.selfies },
      chorePhotos: { increment: inc.chorePhotos },
      cropsMask: existing.cropsMask | bit,
    },
  });
}

function toCounters(
  row: {
    harvests: number;
    waterings: number;
    plantings: number;
    selfies: number;
    chorePhotos: number;
    cropsMask: number;
  } | null,
  activeDays: number,
): AccoladeCounters {
  return { ...(row ?? emptyCounters), activeDays };
}

function counterFor(
  def: { counter: (typeof SEASONAL_TRACKS)[number]["counter"] },
  counters: AccoladeCounters,
): number {
  if (def.counter === "crops") {
    return (counters.cropsMask & 1 ? 1 : 0) + (counters.cropsMask & 2 ? 1 : 0) + (counters.cropsMask & 4 ? 1 : 0);
  }
  if (def.counter === "activeDays") return counters.activeDays;
  if (def.counter === "camera") return counters.selfies + counters.chorePhotos;
  return counters[def.counter];
}

export async function recordAccoladeEvent(
  tx: Tx,
  opts: { playerId: string; timezone: string; event: AccoladeEvent; now?: Date },
) {
  const now = opts.now ?? new Date();
  const currentSeason = seasonKey(opts.timezone, now);
  const day = todayKey(opts.timezone, now);
  await bump(tx, opts.playerId, LIFETIME_SEASON_KEY, opts.event);
  await bump(tx, opts.playerId, currentSeason, opts.event);
  await tx.accoladeActiveDay.upsert({
    where: { playerId_dayKey: { playerId: opts.playerId, dayKey: day } },
    create: { playerId: opts.playerId, dayKey: day, seasonKey: currentSeason },
    update: {},
  });

  const [lifetimeRow, seasonRow, lifetimeDays, seasonDays, existing] = await Promise.all([
    tx.accoladeCounter.findUnique({
      where: { playerId_seasonKey: { playerId: opts.playerId, seasonKey: LIFETIME_SEASON_KEY } },
    }),
    tx.accoladeCounter.findUnique({
      where: { playerId_seasonKey: { playerId: opts.playerId, seasonKey: currentSeason } },
    }),
    tx.accoladeActiveDay.count({ where: { playerId: opts.playerId } }),
    tx.accoladeActiveDay.count({ where: { playerId: opts.playerId, seasonKey: currentSeason } }),
    tx.accoladeUnlock.findMany({ where: { playerId: opts.playerId } }),
  ]);

  const drafts = evaluateUnlocks({
    seasonKey: currentSeason,
    seasonal: toCounters(seasonRow, seasonDays),
    lifetime: toCounters(lifetimeRow, lifetimeDays),
    existingKeys: existing.map((row) =>
      unlockKey({
        kind: row.kind as "seasonal" | "lifetime",
        slug: row.slug,
        medal: (row.medal || null) as AccoladeMedal | null,
        seasonKey: row.seasonKey,
      }),
    ),
  });

  const created = [];
  for (const draft of drafts) {
    const row = await tx.accoladeUnlock.create({
      data: {
        playerId: opts.playerId,
        slug: draft.slug,
        kind: draft.kind,
        seasonKey: draft.seasonKey,
        medal: draft.medal ?? "",
        title: draft.title,
        emoji: draft.emoji,
        blurb: draft.blurb,
      },
    });
    created.push(row);
  }
  return created.map(publicUnlock);
}

export async function playerAccoladeLedger(playerId: string, timezone: string, now = new Date()) {
  const currentSeason = seasonKey(timezone, now);
  const [lifetimeRow, seasonRow, lifetimeDays, seasonDays, unlockRows] = await Promise.all([
    prisma.accoladeCounter.findUnique({
      where: { playerId_seasonKey: { playerId, seasonKey: LIFETIME_SEASON_KEY } },
    }),
    prisma.accoladeCounter.findUnique({
      where: { playerId_seasonKey: { playerId, seasonKey: currentSeason } },
    }),
    prisma.accoladeActiveDay.count({ where: { playerId } }),
    prisma.accoladeActiveDay.count({ where: { playerId, seasonKey: currentSeason } }),
    prisma.accoladeUnlock.findMany({ where: { playerId }, orderBy: { unlockedAt: "asc" } }),
  ]);
  const seasonal = toCounters(seasonRow, seasonDays);
  const lifetime = toCounters(lifetimeRow, lifetimeDays);
  const unlocks = unlockRows.map(publicUnlock);
  return {
    timezone,
    seasonKey: currentSeason,
    seasonLabel: seasonLabel(currentSeason),
    seasonal: {
      counters: seasonal,
      tracks: SEASONAL_TRACKS.map((def) => {
        const count = counterFor(def, seasonal);
        const next = def.steps ? nextStep(count, def.steps) : { medal: null, at: 0, remaining: 0, done: true };
        return {
          slug: def.slug,
          title: def.title,
          emoji: def.emoji,
          blurb: def.blurb,
          count,
          next,
          medals: def.steps ? medalsEarned(count, def.steps) : [],
        };
      }),
      unlocks: unlocks.filter((u) => u.kind === "seasonal" && u.seasonKey === currentSeason),
    },
    lifetime: {
      counters: lifetime,
      legends: LIFETIME_LEGENDS.map((def) => {
        const count = counterFor(def, lifetime);
        const at = def.lifetimeAt ?? 1;
        return {
          slug: def.slug,
          title: def.title,
          emoji: def.emoji,
          blurb: def.blurb,
          count,
          at,
          earned: count >= at,
          remaining: Math.max(0, at - count),
        };
      }),
      unlocks: unlocks.filter((u) => u.kind === "lifetime"),
    },
  };
}

export async function farmAccoladeLedgers(timezone: string, now = new Date()) {
  const kids = await prisma.player.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, mascot: true },
  });
  const ledgers = [];
  for (const kid of kids) {
    ledgers.push({
      id: kid.id,
      name: kid.name,
      mascot: kid.mascot,
      ...(await playerAccoladeLedger(kid.id, timezone, now)),
    });
  }
  return {
    timezone,
    seasonKey: seasonKey(timezone, now),
    seasonLabel: seasonLabel(seasonKey(timezone, now)),
    kids: ledgers,
  };
}
