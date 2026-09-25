import { chicagoDayKeys, startOfDaysAgo, todayKey } from "./tz.js";

export type ParentStatsRange = "week" | "month";

export type ParentClaimRow = {
  playerId: string;
  choreId: string;
  choreTitle: string;
  choreEmoji: string;
  status: "PENDING" | "APPROVED" | "DENIED";
  claimedAt: Date;
  resolvedAt: Date | null;
};

export type ParentKidMeta = {
  id: string;
  name: string;
  mascot: string;
};

export function rangeDayCount(range: ParentStatsRange): number {
  return range === "month" ? 30 : 7;
}

export function parseParentStatsRange(value: unknown): ParentStatsRange {
  if (value === undefined || value === null || value === "") return "week";
  if (value === "week" || value === "month") return value;
  throw Object.assign(new Error("Use week or month."), { statusCode: 400 });
}

export function statsLookbackStart(timezone: string, now = new Date()): Date {
  return startOfDaysAgo(timezone, 60, now);
}

function dayKey(timezone: string, at: Date): string {
  return todayKey(timezone, at);
}

function inWindow(timezone: string, at: Date, startKey: string, endKey: string): boolean {
  const key = dayKey(timezone, at);
  return key >= startKey && key <= endKey;
}

export function consecutiveApprovalStreak(
  approvedDayKeys: Iterable<string>,
  timezone: string,
  at = new Date(),
  lookback = 60,
): number {
  const set = new Set(approvedDayKeys);
  const newestFirst = [...chicagoDayKeys(timezone, lookback, at)].reverse();
  let i = 0;
  if (newestFirst[0] && !set.has(newestFirst[0])) i = 1;
  let n = 0;
  for (; i < newestFirst.length; i += 1) {
    const key = newestFirst[i];
    if (!key || !set.has(key)) break;
    n += 1;
  }
  return n;
}

export function buildParentStats(opts: {
  kids: ParentKidMeta[];
  claims: ParentClaimRow[];
  range: ParentStatsRange;
  timezone: string;
  now?: Date;
}) {
  const now = opts.now ?? new Date();
  const days = chicagoDayKeys(opts.timezone, rangeDayCount(opts.range), now);
  const rangeStartKey = days[0]!;
  const rangeEndKey = days[days.length - 1]!;

  return {
    range: opts.range,
    timezone: opts.timezone,
    days,
    kids: opts.kids.map((kid) => {
      const theirs = opts.claims.filter((row) => row.playerId === kid.id);
      const claimedInRange = theirs.filter((row) => inWindow(opts.timezone, row.claimedAt, rangeStartKey, rangeEndKey));
      const resolvedApprovals = theirs.filter((row) => {
        if (row.status !== "APPROVED") return false;
        return inWindow(opts.timezone, row.resolvedAt ?? row.claimedAt, rangeStartKey, rangeEndKey);
      });
      const resolvedDenials = theirs.filter((row) => {
        if (row.status !== "DENIED") return false;
        return inWindow(opts.timezone, row.resolvedAt ?? row.claimedAt, rangeStartKey, rangeEndKey);
      });
      const approvedDays = theirs
        .filter((row) => row.status === "APPROVED")
        .map((row) => dayKey(opts.timezone, row.resolvedAt ?? row.claimedAt));
      const series = days.map((day) => ({
        day,
        claims: claimedInRange.filter((row) => dayKey(opts.timezone, row.claimedAt) === day).length,
        approvals: resolvedApprovals.filter((row) => dayKey(opts.timezone, row.resolvedAt ?? row.claimedAt) === day)
          .length,
        denials: resolvedDenials.filter((row) => dayKey(opts.timezone, row.resolvedAt ?? row.claimedAt) === day).length,
      }));
      const byChore = new Map<
        string,
        { choreId: string; title: string; emoji: string; claims: number; approvals: number; denials: number }
      >();
      for (const row of claimedInRange) {
        const current = byChore.get(row.choreId) ?? {
          choreId: row.choreId,
          title: row.choreTitle,
          emoji: row.choreEmoji,
          claims: 0,
          approvals: 0,
          denials: 0,
        };
        current.claims += 1;
        if (row.status === "APPROVED") current.approvals += 1;
        if (row.status === "DENIED") current.denials += 1;
        byChore.set(row.choreId, current);
      }
      const chores = [...byChore.values()].sort(
        (a, b) => b.approvals - a.approvals || b.claims - a.claims || a.title.localeCompare(b.title),
      );
      return {
        id: kid.id,
        name: kid.name,
        mascot: kid.mascot,
        claims: claimedInRange.length,
        approvals: resolvedApprovals.length,
        denials: resolvedDenials.length,
        streak: consecutiveApprovalStreak(approvedDays, opts.timezone, now),
        series,
        chores,
      };
    }),
  };
}
