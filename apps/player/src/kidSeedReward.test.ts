import assert from "node:assert/strict";
import test from "node:test";
import { kidSeedRewardCount, kidSeedRewardLabel } from "./kidSeedReward.ts";

test("kidSeedRewardLabel pluralizes", () => {
  assert.equal(kidSeedRewardLabel(1), "+1 seed");
  assert.equal(kidSeedRewardLabel(2), "+2 seeds");
  assert.equal(kidSeedRewardLabel(undefined), "+1 seed");
});

test("kidSeedRewardCount defaults to 1", () => {
  assert.equal(kidSeedRewardCount(2), 2);
  assert.equal(kidSeedRewardCount(0), 1);
  assert.equal(kidSeedRewardCount(null), 1);
});
