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

export function chicagoDayKeys(timezone: string, days: number, at = new Date()): string[] {
  const start = DateTime.fromJSDate(at).setZone(timezone).startOf("day");
  return Array.from({ length: days }, (_, i) => start.minus({ days: days - 1 - i }).toFormat("yyyy-LL-dd"));
}
