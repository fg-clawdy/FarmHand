import assert from "node:assert/strict";
import test from "node:test";
import { chorePeriod } from "./tz.js";
import { choreClaimGate } from "@farmhand/shared";

test("DAILY period is the Chicago calendar day", () => {
  const at = new Date("2026-09-09T03:30:00.000Z"); // Sep 8 evening in Chicago
  const period = chorePeriod("DAILY", "America/Chicago", at);
  assert.equal(period.key, "2026-09-08");
  assert.equal(period.eligible, true);
});

test("WEEKDAYS is ineligible on Chicago Saturday", () => {
  const saturday = new Date("2026-09-12T18:00:00.000Z");
  const period = chorePeriod("WEEKDAYS", "America/Chicago", saturday);
  assert.equal(period.eligible, false);
  assert.equal(period.key, "2026-09-12");
});

test("WEEKLY key is the Monday of that Chicago week", () => {
  const wed = new Date("2026-09-09T17:00:00.000Z");
  const period = chorePeriod("WEEKLY", "America/Chicago", wed);
  assert.equal(period.key, "2026-09-07-week");
  assert.equal(period.eligible, true);
});

test("NONE uses a reusable open slot", () => {
  const period = chorePeriod("NONE", "America/Chicago", new Date("2026-09-09T17:00:00.000Z"));
  assert.equal(period.key, "open");
  assert.equal(period.eligible, true);
});

test("race taken blocks a second kid", () => {
  const gate = choreClaimGate({
    isActive: true,
    periodEligible: true,
    assignmentMode: "RACE",
    hasAssignment: false,
    alreadyClaimedByPlayer: false,
    raceTaken: true,
  });
  assert.equal(gate.ok, false);
});
