import assert from "node:assert/strict";
import test from "node:test";
import { formatJobBoardReward, JOB_BOARD_V1_REWARD_SEED_COUNT } from "@farmhand/shared";
import { PLACEHOLDER_WANTED_JOBS } from "./jobBoard.ts";

test("placeholder jobs grant the v1 seed reward", () => {
  assert.ok(PLACEHOLDER_WANTED_JOBS.length >= 2);
  for (const job of PLACEHOLDER_WANTED_JOBS) {
    assert.equal(job.rewardSeedCount, JOB_BOARD_V1_REWARD_SEED_COUNT);
    assert.equal(formatJobBoardReward(job), "Reward: 1 seed");
  }
});

test("empty farm flyer has no fake reward or title", () => {
  assert.equal(formatJobBoardReward(null), "Check back soon");
});
