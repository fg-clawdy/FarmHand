import assert from "node:assert/strict";
import test from "node:test";
import { formatJobBoardReward, JOB_BOARD_V1_REWARD_SEED_COUNT } from "./chores.js";

test("v1 farm jobs grant 1 seed", () => {
  assert.equal(JOB_BOARD_V1_REWARD_SEED_COUNT, 1);
  assert.equal(formatJobBoardReward({ rewardSeedCount: 1 }), "Reward: 1 seed");
  assert.equal(formatJobBoardReward({}), "Reward: 1 seed");
});

test("empty board has no fake reward", () => {
  assert.equal(formatJobBoardReward(null), "Check back soon");
  assert.equal(formatJobBoardReward(undefined), "Check back soon");
});

test("formatJobBoardReward pluralizes seed kinds", () => {
  assert.equal(formatJobBoardReward({ rewardSeedCount: 2 }), "Reward: 2 seeds");
  assert.equal(formatJobBoardReward({ rewardSeedCount: 1, rewardSeedKind: "super_seed" }), "Reward: 1 super seed");
  assert.equal(formatJobBoardReward({ rewardSeedCount: 3, rewardSeedKind: "super_seed" }), "Reward: 3 super seeds");
});

test("rewardLabel overrides the generated line", () => {
  assert.equal(formatJobBoardReward({ rewardSeedCount: 1, rewardLabel: "Reward: 2 super seeds" }), "Reward: 2 super seeds");
});
