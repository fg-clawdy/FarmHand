/** Fire-and-forget Job Board HEAT events — must not block claim UX. */
export type BoardEventType = "BOARD_OPEN" | "CLAIM" | "DISMISS" | "RIGHT_NOW_IMPRESSION";
export type BoardEventSource = "GARDEN_JOB_BOARD" | "FARM_CORKBOARD";

export function recordBoardEvent(opts: {
  eventType: BoardEventType;
  source: BoardEventSource;
  choreId?: string | null;
  suggestedSlot?: boolean;
  meta?: Record<string, unknown>;
}): void {
  const body = JSON.stringify({
    eventType: opts.eventType,
    source: opts.source,
    choreId: opts.choreId ?? null,
    suggestedSlot: opts.suggestedSlot ?? null,
    meta: opts.meta ?? null,
  });
  try {
    void fetch("/api/chores/board-events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // ignore
  }
}
