import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CLEAR_POST_DELAY_MS,
  CLEAR_RETRY_DELAY_MS,
  CLEAR_STAND_IN_TITLE,
  approvalIdentity,
  closeLeftoverClearNotifications,
  closeStaleApprovalNotifications,
  dismissClearPush,
  isStaleApprovalNotification,
  mustPresentClearNotification,
  notificationMatchesRequest,
} from "../public/push-clear.js";

function note(partial) {
  return {
    title: partial.title ?? "",
    tag: partial.tag ?? "",
    data: partial.data ?? {},
    posted: partial.posted ?? true,
    closed: false,
    closeLostRace: false,
    close() {
      if (!this.posted) {
        this.closeLostRace = true;
        return;
      }
      this.closed = true;
    },
  };
}

/**
 * Android-style registration: showNotification records a note that is not
 * posted yet, so close() before the platform commits it is a no-op.
 * `wait` marks every note posted, which is what the delayed close relies on.
 */
function createRegistration(initial = []) {
  const notes = initial.map((item) => note(item));
  return {
    notes,
    showCalls: [],
    async getNotifications() {
      return notes.filter((item) => !item.closed);
    },
    async showNotification(title, options = {}) {
      this.showCalls.push({ title, options });
      const created = note({
        title,
        tag: options.tag,
        data: options.data,
        posted: false,
      });
      for (const existing of notes) {
        if (existing.tag && existing.tag === created.tag) existing.closed = true;
      }
      notes.push(created);
    },
  };
}

const clearPayload = {
  type: "clear",
  kind: "chore_claim",
  subjectId: "claim-1",
  tag: "approval:chore_claim:claim-1",
  title: "Taken care of",
  body: "Another grown-up already approved or denied this.",
};

test("chromium clear closes the tagged notification and shows nothing", async () => {
  const reg = createRegistration([
    {
      title: "🌅 Dog chore — Feed Dog A.M.",
      tag: clearPayload.tag,
      data: { type: "approval_request", kind: "chore_claim", subjectId: "claim-1" },
    },
    {
      title: "Other chore",
      tag: "approval:chore_claim:other",
      data: { type: "approval_request", kind: "chore_claim", subjectId: "other" },
    },
    {
      title: "The family jar is full!",
      tag: "shared-goal:goal-1",
      data: { type: "info", kind: "shared_goal", subjectId: "goal-1" },
    },
  ]);

  await dismissClearPush(reg, clearPayload, { presentStandIn: false });

  assert.equal(reg.showCalls.length, 0);
  const open = await reg.getNotifications();
  assert.deepEqual(
    open.map((item) => item.tag),
    ["approval:chore_claim:other", "shared-goal:goal-1"],
  );
});

test("clear matches a notification by request id when the tag differs", async () => {
  const reg = createRegistration([
    {
      title: "Store request — Ice cream",
      tag: "some-other-tag",
      data: { type: "approval_request", kind: "store_redemption", subjectId: "red-9" },
    },
  ]);

  await dismissClearPush(
    reg,
    { type: "clear", kind: "store_redemption", subjectId: "red-9", tag: "approval:store_redemption:red-9" },
    { presentStandIn: false },
  );

  assert.equal((await reg.getNotifications()).length, 0);
  assert.equal(notificationMatchesRequest(reg.notes[0], { tag: "", subjectId: "red-9", kind: "chore_claim" }), false);
});

test("a clear with nothing open leaves the shade empty", async () => {
  const reg = createRegistration();
  await dismissClearPush(reg, clearPayload, { presentStandIn: false });
  assert.equal(reg.showCalls.length, 0);
  assert.equal((await reg.getNotifications()).length, 0);
});

test("safari stand-in is blank, silent, and closed only after it is posted", async () => {
  const reg = createRegistration([
    {
      title: "Willow · Make your bed",
      tag: clearPayload.tag,
      data: { type: "approval_request", kind: "chore_claim", subjectId: "claim-1" },
    },
  ]);
  const waits = [];

  await dismissClearPush(reg, clearPayload, {
    presentStandIn: true,
    wait: async (ms) => {
      waits.push(ms);
      for (const item of reg.notes) item.posted = true;
    },
  });

  assert.deepEqual(waits, [CLEAR_POST_DELAY_MS, CLEAR_RETRY_DELAY_MS]);
  assert.equal(reg.showCalls.length, 1);
  assert.equal(reg.showCalls[0].title, CLEAR_STAND_IN_TITLE);
  assert.equal(reg.showCalls[0].options.body, "");
  assert.equal(reg.showCalls[0].options.silent, true);
  assert.equal(reg.showCalls[0].options.renotify, false);
  assert.equal(reg.showCalls[0].options.data.type, "clear");
  assert.equal(reg.showCalls[0].options.data.ephemeral, true);
  assert.equal((await reg.getNotifications()).length, 0);
  assert.equal(
    reg.notes.some((item) => item.title === "Taken care of"),
    false,
  );
});

test("closing a stand-in before the platform posts it would leave the banner", async () => {
  const reg = createRegistration();
  await reg.showNotification("Taken care of", {
    body: "Another grown-up already approved or denied this.",
    tag: clearPayload.tag,
    data: clearPayload,
  });
  const shown = (await reg.getNotifications())[0];
  shown.close();
  assert.equal(shown.closeLostRace, true);
  assert.equal(shown.closed, false);
  shown.posted = true;
  shown.close();
  assert.equal((await reg.getNotifications()).length, 0);
});

test("opening the app drops resolved requests and leftover clear banners", async () => {
  const reg = createRegistration([
    {
      title: "Still waiting",
      tag: "approval:chore_claim:keep",
      data: { type: "approval_request", kind: "chore_claim", subjectId: "keep" },
    },
    {
      title: "Already approved",
      tag: "approval:chore_claim:done",
      data: { type: "approval_request", kind: "chore_claim", subjectId: "done" },
    },
    {
      title: "Taken care of",
      tag: "approval:store_redemption:old",
      data: {
        type: "clear",
        kind: "store_redemption",
        subjectId: "old",
        title: "Taken care of",
        body: "Another grown-up already approved or denied this.",
      },
    },
    {
      title: "The family jar is full!",
      tag: "shared-goal:goal-1",
      data: { type: "info", kind: "shared_goal", subjectId: "goal-1" },
    },
  ]);

  const closed = await closeStaleApprovalNotifications(reg, [
    { kind: "chore_claim", subjectId: "keep" },
  ]);
  assert.equal(closed, 2);
  const open = await reg.getNotifications();
  assert.deepEqual(
    open.map((item) => item.title).sort(),
    ["Still waiting", "The family jar is full!"],
  );
});

test("activate closes a leftover Taken care of banner without an inbox list", async () => {
  const reg = createRegistration([
    {
      title: "Taken care of",
      tag: "approval:chore_claim:claim-1",
      data: { type: "clear", kind: "chore_claim", subjectId: "claim-1" },
    },
    {
      title: "Still waiting",
      tag: "approval:chore_claim:keep",
      data: { type: "approval_request", kind: "chore_claim", subjectId: "keep" },
    },
  ]);
  assert.equal(await closeLeftoverClearNotifications(reg), 1);
  const open = await reg.getNotifications();
  assert.deepEqual(
    open.map((item) => item.title),
    ["Still waiting"],
  );
});

test("stale check ignores unrelated notifications and keeps pending ones", () => {
  const pending = new Set(["chore_claim:keep"]);
  assert.equal(
    isStaleApprovalNotification(
      { tag: "approval:chore_claim:keep", data: { type: "approval_request", kind: "chore_claim", subjectId: "keep" } },
      pending,
    ),
    false,
  );
  assert.equal(
    isStaleApprovalNotification(
      { tag: "approval:chore_claim:gone", data: { type: "approval_request", kind: "chore_claim", subjectId: "gone" } },
      pending,
    ),
    true,
  );
  assert.equal(
    isStaleApprovalNotification({ tag: "shared-goal:goal-1", data: { type: "info", kind: "shared_goal" } }, pending),
    false,
  );
  assert.equal(approvalIdentity({ tag: "approval:store_redemption:red-1", data: {} }), "store_redemption:red-1");
});

test("only WebKit clients must present a stand-in for a clear push", () => {
  assert.equal(mustPresentClearNotification("Mozilla/5.0 (Linux; Android 14) Chrome/128.0.0.0 Mobile"), false);
  assert.equal(
    mustPresentClearNotification(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 CriOS/128.0.0.0 Mobile/15E148 Safari/604.1",
    ),
    true,
  );
  assert.equal(
    mustPresentClearNotification(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
    ),
    true,
  );
  assert.equal(
    mustPresentClearNotification(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
    ),
    false,
  );
  assert.equal(
    mustPresentClearNotification("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15", {
      maxTouchPoints: 5,
    }),
    true,
  );
  assert.equal(
    mustPresentClearNotification(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36",
      { maxTouchPoints: 5 },
    ),
    false,
  );
});

test("service worker clear path does not show the replacement banner", () => {
  const sw = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
  const register = readFileSync(new URL("./push.ts", import.meta.url), "utf8");
  assert.match(sw, /from "\.\/push-clear\.js"/);
  assert.match(sw, /dismissClearPush/);
  assert.match(sw, /payload\.type === "clear"/);
  assert.doesNotMatch(sw, /Taken care of/);
  assert.doesNotMatch(sw, /Another grown-up/);
  assert.match(register, /type:\s*"module"/);
});
