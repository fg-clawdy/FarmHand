import { DateTime } from "luxon";
import { prisma } from "./db.js";
import { loadConfig } from "./game.js";
import { seasonKey, startOfToday } from "./tz.js";

export type ReviewPeriodKey = "day" | "week" | "season" | "all";

export type ReviewKpis = {
  label: string;
  rangeLabel: string;
  starsEarned: number;
  harvests: number;
  freeSeeds: number;
  plantings: number;
  waterings: number;
  choresDone: number;
  selfies: number;
  badges: number;
  daysPlayed: number;
};

export type PlayerReview = {
  timezone: string;
  seasonKey: string;
  periods: Record<ReviewPeriodKey, ReviewKpis>;
};

function periodBounds(timezone: string, at = new Date()) {
  const zoned = DateTime.fromJSDate(at).setZone(timezone);
  const dayStart = startOfToday(timezone, at);
  const weekStart = zoned.startOf("week").toUTC().toJSDate();
  const quarter = Math.ceil(zoned.month / 3);
  const seasonStart = DateTime.fromObject(
    { year: zoned.year, month: (quarter - 1) * 3 + 1, day: 1 },
    { zone: timezone },
  )
    .startOf("day")
    .toUTC()
    .toJSDate();
  return {
    day: { since: dayStart, label: "Today", rangeLabel: zoned.toFormat("ccc, LLL d") },
    week: {
      since: weekStart,
      label: "This week",
      rangeLabel: `${DateTime.fromJSDate(weekStart).setZone(timezone).toFormat("LLL d")} – ${zoned.toFormat("LLL d")}`,
    },
    season: {
      since: seasonStart,
      label: "This season",
      rangeLabel: seasonKey(timezone, at),
    },
    all: { since: null as Date | null, label: "All time", rangeLabel: "Everything so far" },
  };
}

async function kpisFor(
  playerId: string,
  since: Date | null,
  label: string,
  rangeLabel: string,
): Promise<ReviewKpis> {
  const createdAt = since ? { gte: since } : undefined;
  const whereTime = createdAt ? { createdAt } : {};

  const [
    starAgg,
    harvestLogs,
    plantCount,
    waterCount,
    selfieCount,
    choreDone,
    badgeCount,
    daysPlayed,
  ] = await Promise.all([
    prisma.starLedgerEvent.aggregate({
      where: {
        playerId,
        kind: { in: ["EARN_HARVEST", "EARN_GRANT"] },
        ...whereTime,
      },
      _sum: { amount: true },
    }),
    prisma.activityLog.findMany({
      where: { playerId, action: "harvest", ...whereTime },
      select: { details: true },
    }),
    prisma.activityLog.count({ where: { playerId, action: "plant", ...whereTime } }),
    prisma.activityLog.count({ where: { playerId, action: "watering", ...whereTime } }),
    prisma.activityLog.count({ where: { playerId, action: "selfie", ...whereTime } }),
    prisma.choreClaim.count({
      where: {
        playerId,
        status: "APPROVED",
        ...(since ? { resolvedAt: { gte: since } } : { resolvedAt: { not: null } }),
      },
    }),
    prisma.accoladeUnlock.count({
      where: { playerId, ...(since ? { unlockedAt: { gte: since } } : {}) },
    }),
    since
      ? prisma.accoladeActiveDay.count({
          where: {
            playerId,
            dayKey: {
              gte: DateTime.fromJSDate(since).toFormat("yyyy-LL-dd"),
            },
          },
        })
      : prisma.accoladeActiveDay.count({ where: { playerId } }),
  ]);

  let freeSeeds = 0;
  for (const log of harvestLogs) {
    const d = (log.details ?? {}) as { seedsFromShards?: number };
    freeSeeds += Math.max(0, Number(d.seedsFromShards) || 0);
  }

  return {
    label,
    rangeLabel,
    starsEarned: starAgg._sum.amount ?? 0,
    harvests: harvestLogs.length,
    freeSeeds,
    plantings: plantCount,
    waterings: waterCount,
    choresDone: choreDone,
    selfies: selfieCount,
    badges: badgeCount,
    daysPlayed,
  };
}

export async function playerReview(playerId: string): Promise<PlayerReview> {
  const config = await loadConfig();
  const tz = config.timezone;
  const bounds = periodBounds(tz);
  const sk = seasonKey(tz);
  const [day, week, season, all] = await Promise.all([
    kpisFor(playerId, bounds.day.since, bounds.day.label, bounds.day.rangeLabel),
    kpisFor(playerId, bounds.week.since, bounds.week.label, bounds.week.rangeLabel),
    kpisFor(playerId, bounds.season.since, bounds.season.label, bounds.season.rangeLabel),
    kpisFor(playerId, bounds.all.since, bounds.all.label, bounds.all.rangeLabel),
  ]);
  return {
    timezone: tz,
    seasonKey: sk,
    periods: { day, week, season, all },
  };
}
