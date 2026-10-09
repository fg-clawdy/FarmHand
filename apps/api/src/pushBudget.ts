import type { ApprovalKind } from "./push.js";

/**
 * Chrome's silent-push budget, and how FarmHand stays inside it.
 *
 * A fully engaged site earns about 0.5 budget units an hour (12/day). A silent
 * push costs 2, so the ceiling is about 6 silent pushes a day — and a Parent
 * phone that is only opened to approve chores earns less. Past the budget,
 * Chrome posts its own "This site has been updated in the background" card,
 * which the site cannot dismiss.
 *
 * Silent clears stay the primary path. We spend at most SILENT_CLEAR_DAILY_CAP
 * of them per device per rolling 24h, and only for a device that was actually
 * sent the original notification, is not the parent who just resolved it, and
 * whose notification is younger than SILENT_CLEAR_MAX_AGE_MS. A burst of
 * resolves for one device collapses into one push (SILENT_CLEAR_DEBOUNCE_MS).
 * Anything we skip rides along as `resolvedTags` on the next visible push.
 * WebKit still receives a clear (it must show a notification); the cap applies
 * only to silent clients.
 */
export const SILENT_CLEAR_DAILY_CAP = 2;
export const SILENT_CLEAR_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SILENT_CLEAR_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const SILENT_CLEAR_DEBOUNCE_MS = 15_000;
export const PIGGYBACK_TAG_LIMIT = 20;

export type ClearDecision = "send" | "skip-actor" | "skip-stale" | "skip-budget";

export type ClearCandidate = {
  subscriptionId: string;
  adminId: string;
  userAgent: string;
  tag: string;
  kind: ApprovalKind;
  subjectId: string;
  sentAt: number;
  silentClearAts: number[];
};

export function isWebKitPushClient(userAgent: string): boolean {
  const agent = userAgent || "";
  if (/iPhone|iPad|iPod/i.test(agent)) return true;
  const chromium = /Chrome|Chromium|CriOS|FxiOS|Edg\/|OPR\/|SamsungBrowser/.test(agent);
  return /Safari\//.test(agent) && !chromium;
}

export function readSilentClearAts(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
}

export function recentSilentClears(ats: number[], now: number): number[] {
  return ats.filter((stamp) => now - stamp < SILENT_CLEAR_WINDOW_MS && stamp <= now);
}

/** Record one silent push. A coalesced clear is one push, so it counts once. WebKit is unchanged. */
export function noteSilentClearSent(ats: number[], now: number, userAgent: string): number[] {
  const recent = recentSilentClears(ats, now);
  if (isWebKitPushClient(userAgent)) return recent;
  return [...recent, now];
}

export function decideSilentClear(
  row: ClearCandidate,
  opts: { now: number; actorAdminId?: string | null },
): ClearDecision {
  if (opts.actorAdminId && row.adminId === opts.actorAdminId) return "skip-actor";
  if (opts.now - row.sentAt >= SILENT_CLEAR_MAX_AGE_MS) return "skip-stale";
  if (!isWebKitPushClient(row.userAgent) && recentSilentClears(row.silentClearAts, opts.now).length >= SILENT_CLEAR_DAILY_CAP) {
    return "skip-budget";
  }
  return "send";
}

export function planClearFanout<T extends ClearCandidate>(
  candidates: T[],
  opts: { now: number; actorAdminId?: string | null },
): { send: T[]; defer: T[] } {
  const send: T[] = [];
  const defer: T[] = [];
  for (const row of candidates) {
    if (decideSilentClear(row, opts) === "send") send.push(row);
    else defer.push(row);
  }
  return { send, defer };
}

export function selectPiggybackTags(tags: string[], exceptTag?: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tag of tags) {
    if (!tag || tag === exceptTag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= PIGGYBACK_TAG_LIMIT) break;
  }
  return out;
}

export type ClearSubject = { kind: ApprovalKind; subjectId: string; tag: string };

export function subjectsFromClears(rows: Array<{ kind: ApprovalKind; subjectId: string; tag: string }>): ClearSubject[] {
  const seen = new Set<string>();
  const subjects: ClearSubject[] = [];
  for (const row of rows) {
    if (!row.tag || seen.has(row.tag)) continue;
    seen.add(row.tag);
    subjects.push({ kind: row.kind, subjectId: row.subjectId, tag: row.tag });
  }
  return subjects;
}

export function createClearDebouncer<T extends { subscriptionId: string; tag: string }>(opts: {
  windowMs?: number;
  schedule?: (fn: () => void, ms: number) => { cancel: () => void };
  onFlush: (subscriptionId: string, rows: T[]) => void;
}) {
  const windowMs = opts.windowMs ?? SILENT_CLEAR_DEBOUNCE_MS;
  const schedule =
    opts.schedule ??
    ((fn: () => void, ms: number) => {
      const timer = setTimeout(fn, ms);
      return { cancel: () => clearTimeout(timer) };
    });
  const pending = new Map<string, { rows: T[]; cancel: () => void }>();

  function enqueue(row: T) {
    const existing = pending.get(row.subscriptionId);
    existing?.cancel();
    const rows = existing ? [...existing.rows, row] : [row];
    let cancelled = false;
    const handle = schedule(() => {
      if (cancelled) return;
      pending.delete(row.subscriptionId);
      opts.onFlush(row.subscriptionId, rows);
    }, windowMs);
    pending.set(row.subscriptionId, {
      rows,
      cancel() {
        cancelled = true;
        handle.cancel();
      },
    });
  }

  function steal(subscriptionId: string): T[] {
    const bucket = pending.get(subscriptionId);
    if (!bucket) return [];
    bucket.cancel();
    pending.delete(subscriptionId);
    return bucket.rows;
  }

  return { enqueue, steal };
}
