import assert from "node:assert/strict";
import test from "node:test";
import { choreSkipGate, SKIP_SHARD_REWARD } from "./choreSkip.js";

test("SKIP_SHARD_REWARD is 1", () => {
  assert.equal(SKIP_SHARD_REWARD, 1);
});

test("skip gate requires allowsSkip", () => {
  const base = {
    allowsSkip: false,
    isActive: true,
    periodEligible: true,
    assignmentMode: "ALL" as const,
    hasAssignment: true,
    alreadyClaimedByPlayer: false,
    raceTaken: false,
  };
  assert.equal(choreSkipGate(base).ok, false);
  assert.equal(choreSkipGate({ ...base, allowsSkip: true }).ok, true);
});

test("skip gate blocks already claimed/skipped period", () => {
  const g = choreSkipGate({
    allowsSkip: true,
    isActive: true,
    periodEligible: true,
    assignmentMode: "ALL",
    hasAssignment: true,
    alreadyClaimedByPlayer: true,
    raceTaken: false,
  });
  assert.equal(g.ok, false);
});

test("skip gate blocks race taken", () => {
  const g = choreSkipGate({
    allowsSkip: true,
    isActive: true,
    periodEligible: true,
    assignmentMode: "RACE",
    hasAssignment: false,
    alreadyClaimedByPlayer: false,
    raceTaken: true,
  });
  assert.equal(g.ok, false);
});
