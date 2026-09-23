import {
  CHORE_PRIORITY_RANK,
  type ChorePriority,
  type ChoreRecurrence,
  type ChoreTimeOfDay,
  compareChoresForKid,
} from "./choreCatalog.js";

/** Max cards in the garden Job Board "Right now" strip (tablet-friendly). */
export const JOB_BOARD_RIGHT_NOW_MAX = 4;

/** Cap on secondary HEAT boost so tags stay dominant (perfect window ~100+ vs heat ≤25). */
export const CHORE_HEAT_SCORE_BOOST_MAX = 25;

/** Local-hour windows for scoring (family timezone). */
export const CHORE_TIME_WINDOWS = {
  MORNING: { startHour: 5, endHour: 11, label: "Morning" },
  AFTERNOON: { startHour: 11, endHour: 17, label: "Afternoon" },
  EVENING: { startHour: 17, endHour: 22, label: "Evening" },
} as const;

export type ChoreClock = {
  /** 0–23 in the family timezone */
  hour: number;
  /** ISO weekday 1=Mon … 7=Sun */
  weekday: number;
};

export type SuggestableChore = {
  id: string;
  title: string;
  timeOfDay: string;
  recurrence: string;
  priority: string;
  includeInPath: boolean;
  eligible: boolean;
  sortOrder?: number;
  /** Optional 0–100 farm-wide heat from API (ChoreHeat.heatScore). */
  heatScore?: number | null;
};

export type ChoreSuggestPartition<T> = {
  suggested: T[];
  more: T[];
  /** Kid-facing section title, e.g. "Right now · School morning" */
  sectionTitle: string;
  /** Current coarse window used for scoring */
  window: Exclude<ChoreTimeOfDay, "ANYTIME">;
  isWeekend: boolean;
};

function asTimeOfDay(value: string): ChoreTimeOfDay {
  if (value === "MORNING" || value === "AFTERNOON" || value === "EVENING" || value === "ANYTIME") {
    return value;
  }
  return "ANYTIME";
}

function asPriority(value: string): ChorePriority {
  if (value === "CRITICAL" || value === "HIGH" || value === "NORMAL" || value === "LOW") return value;
  return "NORMAL";
}

function asRecurrence(value: string): ChoreRecurrence {
  if (value === "DAILY" || value === "WEEKLY" || value === "WEEKDAYS" || value === "NONE") return value;
  return "DAILY";
}

/** Read hour + ISO weekday in a named IANA timezone (no luxon dependency). */
export function choreClockParts(now: Date, timeZone: string): ChoreClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "12";
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  let hour = Number(hourRaw);
  if (!Number.isFinite(hour)) hour = 12;
  // Some engines emit "24" for midnight with hourCycle h23 — normalize.
  if (hour === 24) hour = 0;
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return { hour, weekday: map[wd] ?? 1 };
}

export function currentChoreTimeOfDay(hour: number): Exclude<ChoreTimeOfDay, "ANYTIME"> {
  const h = ((Math.floor(hour) % 24) + 24) % 24;
  if (h >= CHORE_TIME_WINDOWS.MORNING.startHour && h < CHORE_TIME_WINDOWS.MORNING.endHour) return "MORNING";
  if (h >= CHORE_TIME_WINDOWS.AFTERNOON.startHour && h < CHORE_TIME_WINDOWS.AFTERNOON.endHour) return "AFTERNOON";
  if (h >= CHORE_TIME_WINDOWS.EVENING.startHour && h < CHORE_TIME_WINDOWS.EVENING.endHour) return "EVENING";
  // Late night / early predawn: treat as evening wind-down.
  return "EVENING";
}

export function isWeekendWeekday(weekday: number): boolean {
  return weekday === 6 || weekday === 7;
}

/** Kid-facing label for the suggested strip. */
export function choreSuggestSectionTitle(clock: ChoreClock): string {
  const window = currentChoreTimeOfDay(clock.hour);
  const weekend = isWeekendWeekday(clock.weekday);
  if (window === "MORNING") return weekend ? "Right now · Weekend morning" : "Right now · School morning";
  if (window === "AFTERNOON") return weekend ? "Right now · Weekend afternoon" : "Right now · After school";
  return weekend ? "Right now · Weekend evening" : "Right now · Evening";
}

const WINDOW_ORDER: Exclude<ChoreTimeOfDay, "ANYTIME">[] = ["MORNING", "AFTERNOON", "EVENING"];

function windowDistance(a: Exclude<ChoreTimeOfDay, "ANYTIME">, b: Exclude<ChoreTimeOfDay, "ANYTIME">): number {
  return Math.abs(WINDOW_ORDER.indexOf(a) - WINDOW_ORDER.indexOf(b));
}

function resolveHeatScore(
  chore: { id?: string; heatScore?: number | null },
  heatByChoreId?: Record<string, number>,
): number {
  if (typeof chore.heatScore === "number" && Number.isFinite(chore.heatScore)) {
    return Math.max(0, Math.min(100, chore.heatScore));
  }
  if (chore.id && heatByChoreId && typeof heatByChoreId[chore.id] === "number") {
    return Math.max(0, Math.min(100, heatByChoreId[chore.id]!));
  }
  return 0;
}

/**
 * Higher = more likely to show in "Right now".
 * Catalog tags remain primary; optional heat is a capped secondary boost (+0..25).
 */
export function scoreChoreForNow(
  chore: {
    id?: string;
    timeOfDay: string;
    recurrence: string;
    priority: string;
    includeInPath: boolean;
    heatScore?: number | null;
  },
  clock: ChoreClock,
  heatByChoreId?: Record<string, number>,
): number {
  const nowWindow = currentChoreTimeOfDay(clock.hour);
  const tod = asTimeOfDay(chore.timeOfDay);
  const recurrence = asRecurrence(chore.recurrence);
  const priority = asPriority(chore.priority);
  const weekend = isWeekendWeekday(clock.weekday);

  let score = 0;

  if (tod === "ANYTIME") {
    score += 45;
  } else if (tod === nowWindow) {
    score += 100;
  } else if (windowDistance(tod, nowWindow) === 1) {
    // Soft adjacent boost — e.g. morning dog feed still findable after school.
    score += 35;
  } else {
    score += 5;
  }

  if (recurrence === "WEEKDAYS") {
    score += weekend ? -60 : 25;
  } else if (recurrence === "WEEKLY") {
    score += 10;
  } else if (recurrence === "DAILY") {
    score += 15;
  }

  // Priority: CRITICAL first among peers (rank 0 → +30).
  score += (3 - CHORE_PRIORITY_RANK[priority]) * 10;

  if (chore.includeInPath) score += 12;

  // Secondary HEAT boost (0–100 → +0..CHORE_HEAT_SCORE_BOOST_MAX). Cold perfect-tag still beats hot wrong-window.
  const heat = resolveHeatScore(chore, heatByChoreId);
  score += (heat / 100) * CHORE_HEAT_SCORE_BOOST_MAX;

  return score;
}

/**
 * Split eligible chores into a small "Right now" strip and a "More chores" list.
 * Ineligible / done chores are not included (caller still shows a separate Done section).
 */
export function partitionEligibleChoresForNow<T extends SuggestableChore>(
  chores: readonly T[],
  opts: {
    now?: Date;
    timeZone: string;
    maxSuggested?: number;
    /** Optional map of choreId → heatScore (0–100). Also reads chore.heatScore when present. */
    heatByChoreId?: Record<string, number>;
  },
): ChoreSuggestPartition<T> {
  const clock = choreClockParts(opts.now ?? new Date(), opts.timeZone);
  const max = Math.max(1, opts.maxSuggested ?? JOB_BOARD_RIGHT_NOW_MAX);
  const heatByChoreId = opts.heatByChoreId;
  const eligible = chores.filter((c) => c.eligible);
  const ranked = [...eligible].sort((a, b) => {
    const ds = scoreChoreForNow(b, clock, heatByChoreId) - scoreChoreForNow(a, clock, heatByChoreId);
    if (ds !== 0) return ds;
    return compareChoresForKid(
      {
        includeInPath: a.includeInPath,
        priority: asPriority(a.priority),
        sortOrder: a.sortOrder,
        title: a.title,
      },
      {
        includeInPath: b.includeInPath,
        priority: asPriority(b.priority),
        sortOrder: b.sortOrder,
        title: b.title,
      },
    );
  });

  // Prefer chores that are at least somewhat "for now" (score >= 50 ≈ match or strong anytime).
  const strong = ranked.filter((c) => scoreChoreForNow(c, clock, heatByChoreId) >= 50);
  const pickFrom = strong.length > 0 ? strong : ranked;
  const suggested = pickFrom.slice(0, max);
  const suggestedIds = new Set(suggested.map((c) => c.id));
  const more = ranked.filter((c) => !suggestedIds.has(c.id));

  return {
    suggested,
    more,
    sectionTitle: choreSuggestSectionTitle(clock),
    window: currentChoreTimeOfDay(clock.hour),
    isWeekend: isWeekendWeekday(clock.weekday),
  };
}
