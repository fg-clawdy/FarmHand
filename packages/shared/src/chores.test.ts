import assert from "node:assert/strict";
import test from "node:test";
import {
  formatJobBoardReward,
  formatSeedRewardChip,
  formatWantedSeedLabel,
  JOB_BOARD_V1_REWARD_SEED_COUNT,
  resolveSeedReward,
} from "./chores.js";
import { DEFAULT_GAME_CONFIG } from "./config.js";

test("missing reward count falls back to 1 seed, not a flat catalog payout", () => {
  assert.equal(JOB_BOARD_V1_REWARD_SEED_COUNT, 1);
  assert.equal(formatJobBoardReward({ rewardSeedCount: 1 }), "Reward: 1 seed");
  assert.equal(formatJobBoardReward({}), "Reward: 1 seed");
  assert.equal(formatSeedRewardChip(1), "+1 seed");
  assert.equal(formatSeedRewardChip(2), "+2 seeds");
  assert.equal(formatWantedSeedLabel(1), "+1 SEED");
  assert.equal(formatWantedSeedLabel(4), "+4 SEEDS");
  assert.equal(formatWantedSeedLabel(null), "+1 SEED");
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


test("PRD bands: difficulty 2 (shoes) pays 1 seed, not 2", () => {
  assert.deepEqual(DEFAULT_GAME_CONFIG.seedRewardBandUpperBounds, [2, 4, 6, 8, 10]);
  assert.deepEqual(DEFAULT_GAME_CONFIG.seedRewardBandPayouts, [1, 2, 3, 4, 5]);
  assert.equal(resolveSeedReward({ difficulty: 2, seedReward: null }, DEFAULT_GAME_CONFIG), 1);
  assert.equal(resolveSeedReward({ difficulty: 4, seedReward: null }, DEFAULT_GAME_CONFIG), 2);
  assert.equal(resolveSeedReward({ difficulty: 9, seedReward: null }, DEFAULT_GAME_CONFIG), 5);
});
