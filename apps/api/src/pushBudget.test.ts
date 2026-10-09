import assert from "node:assert/strict";
import test from "node:test";
import {
  PIGGYBACK_TAG_LIMIT,
  SILENT_CLEAR_DAILY_CAP,
  SILENT_CLEAR_DEBOUNCE_MS,
  SILENT_CLEAR_MAX_AGE_MS,
  SILENT_CLEAR_WINDOW_MS,
  createClearDebouncer,
  decideSilentClear,
  isWebKitPushClient,
  noteSilentClearSent,
  planClearFanout,
  recentSilentClears,
  selectPiggybackTags,
  type ClearCandidate,
} from "./pushBudget.ts";

const NOW = Date.parse("2026-10-09T12:00:00.000Z");
const CHROME = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

function candidate(overrides: Partial<ClearCandidate> = {}): ClearCandidate {
  return {
    subscriptionId: "sub-1",
    adminId: "admin-dad",
    userAgent: CHROME,
    tag: "approval:chore_claim:claim-1",
    kind: "chore_claim",
    subjectId: "claim-1",
    sentAt: NOW - 60_000,
    silentClearAts: [],
    ...overrides,
  };
}

test("a fresh clear goes to the other parent who was sent the original", () => {
  const other = candidate({ subscriptionId: "sub-mom", adminId: "admin-mom" });
  const actorPhone = candidate({ subscriptionId: "sub-dad-phone", adminId: "admin-dad" });
  const actorTablet = candidate({ subscriptionId: "sub-dad-tablet", adminId: "admin-dad" });
  const plan = planClearFanout([other, actorPhone, actorTablet], { now: NOW, actorAdminId: "admin-dad" });
  assert.deepEqual(plan.send.map((row) => row.subscriptionId), ["sub-mom"]);
  assert.deepEqual(
    plan.defer.map((row) => row.subscriptionId),
    ["sub-dad-phone", "sub-dad-tablet"],
  );
  assert.equal(decideSilentClear(actorPhone, { now: NOW, actorAdminId: "admin-dad" }), "skip-actor");
});

test("notifications older than 6 hours are not a silent clear", () => {
  const stale = candidate({ sentAt: NOW - SILENT_CLEAR_MAX_AGE_MS });
  const fresh = candidate({ subscriptionId: "sub-2", sentAt: NOW - SILENT_CLEAR_MAX_AGE_MS + 1 });
  assert.equal(decideSilentClear(stale, { now: NOW }), "skip-stale");
  assert.equal(decideSilentClear(fresh, { now: NOW }), "send");
  assert.equal(decideSilentClear({ ...stale, userAgent: IPHONE }, { now: NOW }), "skip-stale");
});

test("chrome stops after 2 silent clears in a rolling 24h; webkit does not", () => {
  assert.equal(SILENT_CLEAR_DAILY_CAP, 2);
  const recent = [NOW - 60_000, NOW - 120_000];
  const chrome = candidate({ silentClearAts: recent });
  const webkit = candidate({ userAgent: IPHONE, silentClearAts: recent });
  assert.equal(decideSilentClear(chrome, { now: NOW }), "skip-budget");
  assert.equal(decideSilentClear(webkit, { now: NOW }), "send");
  assert.equal(decideSilentClear(candidate({ silentClearAts: [NOW - 60_000] }), { now: NOW }), "send");
  const expired = [NOW - SILENT_CLEAR_WINDOW_MS - 1, NOW - SILENT_CLEAR_WINDOW_MS - 2];
  assert.equal(decideSilentClear(candidate({ silentClearAts: expired }), { now: NOW }), "send");
  assert.deepEqual(recentSilentClears(expired, NOW), []);
});

test("a coalesced silent push counts once, and webkit pushes are not counted", () => {
  const once = noteSilentClearSent([], NOW, CHROME);
  assert.deepEqual(once, [NOW]);
  const twice = noteSilentClearSent(once, NOW + 1000, CHROME);
  assert.equal(twice.length, 2);
  assert.deepEqual(noteSilentClearSent(twice, NOW + 2000, IPHONE), twice);
  assert.equal(isWebKitPushClient(IPHONE), true);
  assert.equal(isWebKitPushClient(CHROME), false);
  assert.equal(
    isWebKitPushClient("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15"),
    true,
  );
});

test("debounce collapses a burst for one device into a single flush", () => {
  const scheduled: Array<{ fn: () => void; cancelled: boolean }> = [];
  const flushed: string[][] = [];
  const debouncer = createClearDebouncer({
    windowMs: SILENT_CLEAR_DEBOUNCE_MS,
    schedule(fn) {
      const entry = { fn, cancelled: false };
      scheduled.push(entry);
      return { cancel: () => { entry.cancelled = true; } };
    },
    onFlush(_id, rows) {
      flushed.push(rows.map((row) => row.tag));
    },
  });
  const row = (subscriptionId: string, tag: string) => ({ subscriptionId, tag });
  debouncer.enqueue(row("sub-1", "approval:chore_claim:a"));
  debouncer.enqueue(row("sub-1", "approval:chore_claim:b"));
  debouncer.enqueue(row("sub-2", "approval:store_redemption:c"));
  assert.equal(scheduled.length, 3);
  assert.equal(scheduled[0]!.cancelled, true);
  scheduled[0]!.fn();
  scheduled[1]!.fn();
  scheduled[2]!.fn();
  assert.deepEqual(flushed, [
    ["approval:chore_claim:a", "approval:chore_claim:b"],
    ["approval:store_redemption:c"],
  ]);
});

test("a visible push can steal a pending burst so it is not also sent silent", () => {
  let ran = false;
  const debouncer = createClearDebouncer({
    schedule(fn) {
      return {
        cancel() {
          ran = true;
          void fn;
        },
      };
    },
    onFlush() {
      throw new Error("stolen burst must not flush");
    },
  });
  debouncer.enqueue({ subscriptionId: "sub-1", tag: "approval:chore_claim:a" });
  debouncer.enqueue({ subscriptionId: "sub-1", tag: "approval:chore_claim:b" });
  assert.deepEqual(
    debouncer.steal("sub-1").map((row) => row.tag),
    ["approval:chore_claim:a", "approval:chore_claim:b"],
  );
  assert.equal(ran, true);
  assert.deepEqual(debouncer.steal("sub-1"), []);
});

test("piggyback tags skip the notification being shown, dedupe, and cap", () => {
  const tags = ["approval:chore_claim:new", "approval:chore_claim:a", "approval:chore_claim:a"];
  for (let i = 0; i < 30; i += 1) tags.push(`approval:chore_claim:old-${i}`);
  const selected = selectPiggybackTags(tags, "approval:chore_claim:new");
  assert.equal(selected.length, PIGGYBACK_TAG_LIMIT);
  assert.equal(selected.includes("approval:chore_claim:new"), false);
  assert.equal(selected[0], "approval:chore_claim:a");
  assert.equal(selected.filter((tag) => tag === "approval:chore_claim:a").length, 1);
});
