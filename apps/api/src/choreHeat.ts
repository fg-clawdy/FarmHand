/**
 * Chore board HEAT — learn which jobs kids claim from real play.
 *
 * heatScore scale: 0–100 (farm-wide, one ChoreHeat row per choreId, playerId null).
 *
 * Nightly formula (America/Chicago, last 30d of ChoreBoardEvent):
 *   weight(ageDays) = 0.5^(ageDays / 7)          // ~7-day half-life
 *   W_claim(chore)  = Σ weight for CLAIM on chore
 *   W_dismiss       = Σ weight for DISMISS on chore
 *   W_open          = Σ weight for BOARD_OPEN (board-level, shared denominator)
 *   heatScore       = 100 * clamp01( W_claim / (W_claim + 0.35*W_dismiss + 0.08*W_open + 1) )
 *
 * On successful claim (incremental EMA so learning starts before first nightly):
 *   heatScore = heatScore + (100 - heatScore) * 0.08
 *   claimCount7d/30d bumped; lastClaimedAt = now
 *
 * Ranking: tags stay dominant; scoreChoreForNow adds at most +25 from heat
 *   heatBoost = (heatScore / 100) * 25
 */
import { DateTime } from "luxon";
import type { ChoreBoardEventType, ChoreBoardSource, ChoreBoardTimeBucket, Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { loadConfig } from "./game.js";

export const CHORE_HEAT_MAX = 100;
export const CHORE_HEAT_CLAIM_EMA_ALPHA = 0.08;
export const CHORE_HEAT_HALF_LIFE_DAYS = 7;
export const CHORE_HEAT_LOOKBACK_DAYS = 30;

export type BoardEventInput = {
  eventType: ChoreBoardEventType;
  source: ChoreBoardSource;
  choreId?: string | null;
  playerId?: string | null;
  suggestedSlot?: boolean | null;
  meta?: Prisma.InputJsonValue;
  now?: Date;
  familyTimezone?: string;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

export function timeBucketAndWeekend(timezone: string, at = new Date()): {
  timeOfDayBucket: ChoreBoardTimeBucket;
  isWeekend: boolean;
} {
  const zoned = DateTime.fromJSDate(at).setZone(timezone);
  const hour = zoned.hour;
  let timeOfDayBucket: ChoreBoardTimeBucket = "EVENING";
  if (hour >= 5 && hour < 11) timeOfDayBucket = "MORNING";
  else if (hour >= 11 && hour < 17) timeOfDayBucket = "AFTERNOON";
  else if (hour >= 17 && hour < 22) timeOfDayBucket = "EVENING";
  // Late night / predawn → EVENING (matches choreSuggest)
  const isWeekend = zoned.weekday >= 6;
  return { timeOfDayBucket, isWeekend };
}

function eventWeight(ageDays: number): number {
  return Math.pow(0.5, ageDays / CHORE_HEAT_HALF_LIFE_DAYS);
}

/** Append-only board event. Never throws to callers — log and swallow at route layer. */
export async function recordChoreBoardEvent(input: BoardEventInput): Promise<void> {
  const config = await loadConfig();
  const timezone = input.familyTimezone || config.timezone || "America/Chicago";
  const now = input.now ?? new Date();
  const { timeOfDayBucket, isWeekend } = timeBucketAndWeekend(timezone, now);
  await prisma.choreBoardEvent.create({
    data: {
      familyTimezone: timezone,
      playerId: input.playerId ?? null,
      choreId: input.choreId ?? null,
      eventType: input.eventType,
      timeOfDayBucket,
      isWeekend,
      source: input.source,
      suggestedSlot: input.suggestedSlot ?? null,
      meta: input.meta ?? undefined,
      createdAt: now,
    },
  });
}

export async function loadHeatByChoreId(): Promise<Record<string, number>> {
  const rows = await prisma.choreHeat.findMany({
    select: { choreId: true, heatScore: true },
  });
  const out: Record<string, number> = {};
  for (const row of rows) {
    out[row.choreId] = row.heatScore;
  }
  return out;
}

/** Light EMA bump after a successful claim (server-side). */
export async function bumpHeatOnClaim(opts: {
  choreId: string;
  playerId: string;
  source?: ChoreBoardSource;
  now?: Date;
}): Promise<void> {
  const now = opts.now ?? new Date();
  const source = opts.source ?? "GARDEN_JOB_BOARD";
  await recordChoreBoardEvent({
    eventType: "CLAIM",
    source,
    choreId: opts.choreId,
    playerId: opts.playerId,
    now,
  });

  const existing = await prisma.choreHeat.findUnique({ where: { choreId: opts.choreId } });
  const prev = existing?.heatScore ?? 0;
  const next = prev + (CHORE_HEAT_MAX - prev) * CHORE_HEAT_CLAIM_EMA_ALPHA;
  await prisma.choreHeat.upsert({
    where: { choreId: opts.choreId },
    create: {
      choreId: opts.choreId,
      playerId: null,
      heatScore: next,
      claimCount7d: 1,
      claimCount30d: 1,
      openCount7d: 0,
      lastClaimedAt: now,
    },
    update: {
      heatScore: next,
      claimCount7d: { increment: 1 },
      claimCount30d: { increment: 1 },
      lastClaimedAt: now,
    },
  });
}

/**
 * Full recompute from events. Safe to call manually (admin) or nightly.
 * Returns number of chore heat rows written.
 */
export async function recomputeAllChoreHeat(now = new Date()): Promise<{ chores: number; opens7d: number }> {
  const since = DateTime.fromJSDate(now).minus({ days: CHORE_HEAT_LOOKBACK_DAYS }).toJSDate();
  const since7 = DateTime.fromJSDate(now).minus({ days: 7 }).toJSDate();

  const events = await prisma.choreBoardEvent.findMany({
    where: { createdAt: { gte: since } },
    select: {
      choreId: true,
      eventType: true,
      createdAt: true,
    },
  });

  let openWeight = 0;
  let openCount7d = 0;
  const claimW = new Map<string, number>();
  const dismissW = new Map<string, number>();
  const claim7 = new Map<string, number>();
  const claim30 = new Map<string, number>();
  const lastClaim = new Map<string, Date>();

  for (const ev of events) {
    const ageDays = Math.max(0, (now.getTime() - ev.createdAt.getTime()) / 86_400_000);
    const w = eventWeight(ageDays);
    if (ev.eventType === "BOARD_OPEN") {
      openWeight += w;
      if (ev.createdAt >= since7) openCount7d += 1;
      continue;
    }
    if (!ev.choreId) continue;
    if (ev.eventType === "CLAIM") {
      claimW.set(ev.choreId, (claimW.get(ev.choreId) ?? 0) + w);
      claim30.set(ev.choreId, (claim30.get(ev.choreId) ?? 0) + 1);
      if (ev.createdAt >= since7) claim7.set(ev.choreId, (claim7.get(ev.choreId) ?? 0) + 1);
      const prev = lastClaim.get(ev.choreId);
      if (!prev || ev.createdAt > prev) lastClaim.set(ev.choreId, ev.createdAt);
    } else if (ev.eventType === "DISMISS") {
      dismissW.set(ev.choreId, (dismissW.get(ev.choreId) ?? 0) + w);
    }
  }

  const choreIds = new Set<string>([...claimW.keys(), ...dismissW.keys(), ...lastClaim.keys()]);
  // Also refresh rows for chores that previously had heat but went cold
  const existing = await prisma.choreHeat.findMany({ select: { choreId: true } });
  for (const row of existing) choreIds.add(row.choreId);

  let written = 0;
  for (const choreId of choreIds) {
    const wc = claimW.get(choreId) ?? 0;
    const wd = dismissW.get(choreId) ?? 0;
    const denom = wc + 0.35 * wd + 0.08 * openWeight + 1;
    const heatScore = CHORE_HEAT_MAX * clamp01(wc / denom);
    await prisma.choreHeat.upsert({
      where: { choreId },
      create: {
        choreId,
        playerId: null,
        heatScore,
        claimCount7d: claim7.get(choreId) ?? 0,
        claimCount30d: claim30.get(choreId) ?? 0,
        openCount7d,
        lastClaimedAt: lastClaim.get(choreId) ?? null,
      },
      update: {
        heatScore,
        claimCount7d: claim7.get(choreId) ?? 0,
        claimCount30d: claim30.get(choreId) ?? 0,
        openCount7d,
        lastClaimedAt: lastClaim.get(choreId) ?? null,
        playerId: null,
      },
    });
    written += 1;
  }

  return { chores: written, opens7d: openCount7d };
}

/** Check once per minute; fire full recompute at 03:00 America/Chicago (once per local day). */
export function startChoreHeatNightlySchedule(log?: { info: (obj: unknown, msg?: string) => void }): () => void {
  let lastRunDayKey = "";
  const tick = async () => {
    try {
      const config = await loadConfig();
      const tz = config.timezone || "America/Chicago";
      const zoned = DateTime.now().setZone(tz);
      const dayKey = zoned.toFormat("yyyy-LL-dd");
      if (zoned.hour !== 3 || zoned.minute > 1) return;
      if (lastRunDayKey === dayKey) return;
      lastRunDayKey = dayKey;
      const result = await recomputeAllChoreHeat(zoned.toUTC().toJSDate());
      log?.info?.(result, "chore heat nightly recompute");
    } catch (err) {
      log?.info?.({ err }, "chore heat nightly recompute failed");
    }
  };
  const handle = setInterval(() => {
    void tick();
  }, 60_000);
  // Don't keep process alive solely for the timer in some environments
  if (typeof handle.unref === "function") handle.unref();
  return () => clearInterval(handle);
}
