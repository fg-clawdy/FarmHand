import { DateTime } from "luxon";

export function todayKey(timezone: string, at = new Date()): string {
  return DateTime.fromJSDate(at).setZone(timezone).toFormat("yyyy-LL-dd");
}

export function startOfToday(timezone: string, at = new Date()): Date {
  return DateTime.fromJSDate(at).setZone(timezone).startOf("day").toUTC().toJSDate();
}

export function startOfDaysAgo(timezone: string, days: number, at = new Date()): Date {
  return DateTime.fromJSDate(at)
    .setZone(timezone)
    .startOf("day")
    .minus({ days })
    .toUTC()
    .toJSDate();
}

export function seasonKey(timezone: string, at = new Date()): string {
  const zoned = DateTime.fromJSDate(at).setZone(timezone);
  const quarter = Math.ceil(zoned.month / 3);
  return `${zoned.year}-Q${quarter}`;
}

export function chicagoDayKeys(timezone: string, days: number, at = new Date()): string[] {
  const start = DateTime.fromJSDate(at).setZone(timezone).startOf("day");
  return Array.from({ length: days }, (_, i) => start.minus({ days: days - 1 - i }).toFormat("yyyy-LL-dd"));
}

export function chorePeriod(
  recurrence: "DAILY" | "WEEKLY" | "WEEKDAYS" | "NONE",
  timezone: string,
  at = new Date(),
  activeDays: number[] = [],
): { key: string; eligible: boolean } {
  const zoned = DateTime.fromJSDate(at).setZone(timezone);
  if (recurrence === "NONE") {
    return { key: "open", eligible: activeDays.length === 0 || activeDays.includes(zoned.weekday) };
  }
  if (recurrence === "WEEKLY") {
    const monday = zoned.startOf("week");
    return {
      key: `${monday.toFormat("yyyy-LL-dd")}-week`,
      eligible: activeDays.length === 0 || activeDays.includes(zoned.weekday),
    };
  }
  const key = zoned.toFormat("yyyy-LL-dd");
  if (recurrence === "WEEKDAYS") {
    // activeDays (backfilled to [1..5] for seeded WEEKDAYS) is authoritative;
    // fall back to the legacy weekday<=5 rule when a parent cleared it.
    const eligible = activeDays.length > 0 ? activeDays.includes(zoned.weekday) : zoned.weekday <= 5;
    return { key, eligible };
  }
  return { key, eligible: activeDays.length === 0 || activeDays.includes(zoned.weekday) };
}
