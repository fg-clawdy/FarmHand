import assert from "node:assert/strict";
import test from "node:test";
import {
  approvalTag,
  buildClearPayload,
  buildRequestPayload,
  choreClaimNotificationCopy,
  isGonePushStatus,
  storeRedemptionNotificationCopy,
  vapidConfig,
} from "./push.ts";

test("CRITICAL dog chores get distinctive push copy", () => {
  const dog = choreClaimNotificationCopy({
    playerName: "Willow",
    title: "Feed Dog A.M.",
    emoji: "🌅",
    priority: "CRITICAL",
  });
  assert.equal(dog.critical, true);
  assert.match(dog.title, /Dog chore/);
  assert.match(dog.title, /Feed Dog A\.M\./);
  assert.match(dog.body, /Willow/);

  const normal = choreClaimNotificationCopy({
    playerName: "Finn",
    title: "Make your bed",
    emoji: "🛏️",
    priority: "NORMAL",
  });
  assert.equal(normal.critical, false);
  assert.match(normal.title, /Finn/);
  assert.doesNotMatch(normal.title, /Dog chore/);
});

test("approval tags collapse chore and future store subjects separately", () => {
  assert.equal(approvalTag("chore_claim", "abc"), "approval:chore_claim:abc");
  assert.equal(approvalTag("store_redemption", "abc"), "approval:store_redemption:abc");
});

test("request payload carries Approve/Deny token and shared tag", () => {
  const payload = buildRequestPayload({
    kind: "chore_claim",
    subjectId: "claim-1",
    title: "Dog chore — Walk the Dog",
    body: "Willow planted a waiting seed.",
    actionToken: "secret-token",
    critical: true,
  });
  assert.equal(payload.type, "approval_request");
  assert.equal(payload.tag, "approval:chore_claim:claim-1");
  assert.equal(payload.actionToken, "secret-token");
  assert.equal(payload.url, "/parent/");
  assert.equal(payload.critical, true);
});

test("store request payload deep-links to the Store tab", () => {
  const payload = buildRequestPayload({
    kind: "store_redemption",
    subjectId: "red-1",
    title: "Store request — Ice cream",
    body: "Willow wants this reward. Fulfill or deny.",
    url: "/parent/store",
    actionToken: "store-token",
  });
  assert.equal(payload.kind, "store_redemption");
  assert.equal(payload.tag, "approval:store_redemption:red-1");
  assert.equal(payload.url, "/parent/store");
});

test("clear payload reuses the tag so other devices drop the live actions", () => {
  const payload = buildClearPayload("chore_claim", "claim-1");
  assert.equal(payload.type, "clear");
  assert.equal(payload.tag, "approval:chore_claim:claim-1");
  assert.equal(payload.actionToken, undefined);
});

test("store redemption copy is ready for the same action pattern", () => {
  const copy = storeRedemptionNotificationCopy({ playerName: "Sage", title: "Ice cream" });
  assert.match(copy.title, /Ice cream/);
  assert.match(copy.body, /Sage/);
});

test("expired push endpoints are dropped on 404/410", () => {
  assert.equal(isGonePushStatus(404), true);
  assert.equal(isGonePushStatus(410), true);
  assert.equal(isGonePushStatus(500), false);
});

test("vapid is disabled without both keys", () => {
  const prevPub = process.env.VAPID_PUBLIC_KEY;
  const prevPriv = process.env.VAPID_PRIVATE_KEY;
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  assert.equal(vapidConfig().enabled, false);
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  assert.equal(vapidConfig().enabled, true);
  if (prevPub === undefined) delete process.env.VAPID_PUBLIC_KEY;
  else process.env.VAPID_PUBLIC_KEY = prevPub;
  if (prevPriv === undefined) delete process.env.VAPID_PRIVATE_KEY;
  else process.env.VAPID_PRIVATE_KEY = prevPriv;
});
