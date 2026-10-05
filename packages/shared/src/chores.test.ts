import assert from "node:assert/strict";
import test from "node:test";
import {
  claimWindowLabel,
  claimWindowOpen,
  formatClockTime,
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

test("formatClockTime renders friendly 12-hour labels", () => {
  assert.equal(formatClockTime(0), "12:00 AM");
  assert.equal(formatClockTime(390), "6:30 AM");
  assert.equal(formatClockTime(660), "11:00 AM");
  assert.equal(formatClockTime(720), "12:00 PM");
  assert.equal(formatClockTime(960), "4:00 PM");
  assert.equal(formatClockTime(1320), "10:00 PM");
});

test("claim window opens only before a morning cutoff", () => {
  // start null (from midnight) until 11:00 AM (660)
  assert.equal(claimWindowOpen(null, 660, 0), true);
  assert.equal(claimWindowOpen(null, 660, 659), true);
  assert.equal(claimWindowOpen(null, 660, 660), false);
  assert.equal(claimWindowOpen(null, 660, 720), false);
});

test("claim window opens after a start time through midnight", () => {
  // 4:00 PM (960) through midnight (end null)
  assert.equal(claimWindowOpen(960, null, 959), false);
  assert.equal(claimWindowOpen(960, null, 960), true);
  assert.equal(claimWindowOpen(960, null, 1439), true);
});

test("overnight claim windows wrap past midnight", () => {
  // 10:00 PM (1320) to 6:00 AM (360)
  assert.equal(claimWindowOpen(1320, 360, 1380), true);
  assert.equal(claimWindowOpen(1320, 360, 100), true);
  assert.equal(claimWindowOpen(1320, 360, 600), false);
});

test("no claim window is always open", () => {
  assert.equal(claimWindowOpen(null, null, 500), true);
});

test("claim window labels read naturally", () => {
  assert.equal(claimWindowLabel(null, 660), "before 11:00 AM");
  assert.equal(claimWindowLabel(960, null), "after 4:00 PM");
  assert.equal(claimWindowLabel(960, 1320), "between 4:00 PM and 10:00 PM");
  assert.equal(claimWindowLabel(1320, 360), "from 10:00 PM to 6:00 AM");
  assert.equal(claimWindowLabel(null, null), null);
});
