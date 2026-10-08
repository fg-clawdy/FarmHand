import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_CONFIG } from "@farmhand/shared";
import {
  decodeTuningValue,
  getPath,
  isEligiblePath,
  planChange,
  setPath,
  validateTuningValue,
} from "./tuning.ts";

const config = DEFAULT_GAME_CONFIG;

test("getPath resolves dotted and indexed segments", () => {
  assert.equal(getPath(config, "startingSeeds"), config.startingSeeds);
  assert.equal(getPath(config, "tiers.0.seedCost"), config.tiers[0].seedCost);
  // Numeric segments are 0-based array indices: tiers.1 points at the second tier.
  assert.equal(getPath(config, "tiers.1.seedCost"), config.tiers[1].seedCost);
  assert.equal(getPath(config, "seedRewardBandUpperBounds.2"), config.seedRewardBandUpperBounds[2]);
  assert.throws(() => getPath(config, "tiers.99.seedCost"));
  assert.throws(() => getPath(config, "does.not.exist"));
});

test("setPath deep-clones and leaves the source untouched", () => {
  const next = setPath(config, "tiers.0.seedCost", 123);
  assert.equal(next.tiers[0].seedCost, 123);
  assert.notEqual(next.tiers, config.tiers);
  assert.notEqual(next.tiers[0], config.tiers[0]);
  // The original config row was not mutated.
  assert.notEqual(config.tiers[0].seedCost, 123);
});

test("isEligiblePath only accepts the allow-listed knobs", () => {
  assert.equal(isEligiblePath("startingSeeds"), true);
  assert.equal(isEligiblePath("plotCount"), true);
  assert.equal(isEligiblePath("tiers.0.seedCost"), true);
  assert.equal(isEligiblePath("tiers.4.durationMinutes"), true);
  assert.equal(isEligiblePath("seedRewardBandUpperBounds.3"), true);
  assert.equal(isEligiblePath("seedRewardBandPayouts.0"), true);

  assert.equal(isEligiblePath("bogus"), false);
  assert.equal(isEligiblePath("tiers.0.bogus"), false);
  assert.equal(isEligiblePath("ingredients.0.name"), false);
  assert.equal(isEligiblePath(""), false);
});

test("validateTuningValue enforces per-path bounds", () => {
  assert.equal(validateTuningValue("startingSeeds", 500), null);
  assert.ok(validateTuningValue("startingSeeds", -1)?.length > 0);
  assert.ok(validateTuningValue("startingSeeds", 1.5)?.length > 0);
  assert.equal(validateTuningValue("tiers.0.seedCost", 10), null);
  assert.ok(validateTuningValue("tiers.0.seedCost", -1)?.length > 0);
  assert.equal(validateTuningValue("seedRewardBandUpperBounds.1", 4), null);
  assert.ok(validateTuningValue("seedRewardBandUpperBounds.1", -2)?.length > 0);
  assert.ok(validateTuningValue("not-a-number", 5)?.length > 0);
});

test("planChange runs the three-way merge safely", () => {
  // apply: eligible, values differ, baseline still matches live.
  assert.deepEqual(planChange({ path: "startingSeeds", baseline: config.startingSeeds, current: config.startingSeeds, proposed: config.startingSeeds + 1 }), {
    status: "apply",
    value: config.startingSeeds + 1,
  });
  // noop: live already equals the proposal.
  assert.deepEqual(planChange({ path: "startingSeeds", baseline: config.startingSeeds, current: config.startingSeeds, proposed: config.startingSeeds }), { status: "noop" });
  // conflict: live drifted from baseline and force is false.
  assert.deepEqual(planChange({ path: "startingSeeds", baseline: config.startingSeeds, current: config.startingSeeds + 5, proposed: config.startingSeeds + 1 }), { status: "conflict" });
  // force overrides the conflict.
  assert.deepEqual(planChange({ path: "startingSeeds", baseline: config.startingSeeds, current: config.startingSeeds + 5, proposed: config.startingSeeds + 1, force: true }), {
    status: "apply",
    value: config.startingSeeds + 1,
  });
  // invalid: proposal out of bounds.
  assert.equal(planChange({ path: "startingSeeds", baseline: config.startingSeeds, current: config.startingSeeds, proposed: -3 }).status, "invalid");
  // skip: path not eligible.
  assert.equal(planChange({ path: "bogus", current: 1, proposed: 2 }).status, "skip");
});

test("decodeTuningValue tolerates JSON and bare values", () => {
  assert.equal(decodeTuningValue("7"), 7);
  assert.deepEqual(decodeTuningValue("[1,2,3]"), [1, 2, 3]);
  assert.equal(decodeTuningValue("plain"), "plain");
  assert.equal(decodeTuningValue("null"), null);
});