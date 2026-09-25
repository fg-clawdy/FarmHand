import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GAME_CONFIG,
  mergeGameConfig,
} from "./config.js";
import { cropKindForTier, PLOTS_PER_GARDEN } from "./types.js";

describe("v2 differentiated tier economy", () => {
  it("maps six tiers to corn, cotton, tomato, strawberry, pumpkin, and sunflower", () => {
    assert.deepEqual(
      DEFAULT_GAME_CONFIG.tiers.map((t) => t.kind),
      ["corn", "cotton", "tomato", "strawberry", "pumpkin", "sunflower"],
    );
    assert.equal(cropKindForTier(1), "corn");
    assert.equal(cropKindForTier(2), "cotton");
    assert.equal(cropKindForTier(3), "tomato");
    assert.equal(cropKindForTier(4), "strawberry");
    assert.equal(cropKindForTier(5), "pumpkin");
    assert.equal(cropKindForTier(6), "sunflower");
    assert.equal(cropKindForTier(9), "sunflower");
  });

  it("swaps leftover fantasy names to the v2 crops while keeping tunables", () => {
    const merged = mergeGameConfig({
      tiers: [
        { tier: 1, name: "Prairie Daisy", seedCost: 7, durationMinutes: 12, points: 9, fertilizerReductionMinutes: 3, shardRefund: 1 },
        { tier: 2, name: "Kitchen Herbs", seedCost: 8, durationMinutes: 22, points: 11, fertilizerReductionMinutes: 5, shardRefund: 2 },
        { tier: 3, name: "Sunflower", seedCost: 9, durationMinutes: 32, points: 13, fertilizerReductionMinutes: 7, shardRefund: 3 },
        { tier: 4, name: "Homestead Oak", seedCost: 10, durationMinutes: 42, points: 15, fertilizerReductionMinutes: 9, shardRefund: 4 },
        { tier: 5, name: "Moon Vine", seedCost: 11, durationMinutes: 52, points: 17, fertilizerReductionMinutes: 11, shardRefund: 5 },
      ],
    });
    assert.equal(merged.tiers.length, 6);
    assert.equal(merged.tiers[0]?.name, "Sweet Corn");
    assert.equal(merged.tiers[0]?.kind, "corn");
    assert.equal(merged.tiers[0]?.seedCost, 7);
    assert.equal(merged.tiers[1]?.kind, "cotton");
    assert.equal(merged.tiers[2]?.kind, "tomato");
    assert.equal(merged.tiers[3]?.kind, "strawberry");
    assert.equal(merged.tiers[4]?.kind, "pumpkin");
    assert.equal(merged.tiers[4]?.points, 17);
    assert.equal(merged.tiers[5]?.kind, "sunflower");
  });

  it("raises leftover 6-plot gardens to a full 3×3", () => {
    const merged = mergeGameConfig({ plotCount: 6 });
    assert.equal(merged.plotCount, PLOTS_PER_GARDEN);
    assert.equal(DEFAULT_GAME_CONFIG.plotCount, 9);
  });

  it("seeds the locked balance-goals text when the field is missing", () => {
    const merged = mergeGameConfig({});
    assert.equal(
      merged.balanceGoals,
      "Encourage short daily sessions with healthy watering use; avoid designs that reward only long waits or one OP crop.",
    );
  });

  it("keeps a parent-edited balance-goals string", () => {
    const merged = mergeGameConfig({ balanceGoals: "Kids should try all five crops." });
    assert.equal(merged.balanceGoals, "Kids should try all five crops.");
  });

  it("ships a differentiated 6-tier table with shard refunds and shard-based config", () => {
    assert.equal(DEFAULT_GAME_CONFIG.tiers.length, 6);
    assert.equal(DEFAULT_GAME_CONFIG.shardsPerSeed, 10);
    assert.equal(DEFAULT_GAME_CONFIG.harvestSeedReturn, 1); // deprecated but still present
    for (const tier of DEFAULT_GAME_CONFIG.tiers) {
      assert.equal(typeof tier.seedCost, "number");
      assert.equal(typeof tier.durationMinutes, "number");
      assert.equal(typeof tier.points, "number");
      assert.equal(typeof tier.shardRefund, "number");
    }
  });

  it("boot-merges the old 3-tier flat ladder to the differentiated 6-tier table", () => {
    const merged = mergeGameConfig({
      tiers: [
        { tier: 1, kind: "corn", seedCost: 1, durationMinutes: 24 * 60, points: 1 },
        { tier: 2, kind: "strawberry", seedCost: 2, durationMinutes: 48 * 60, points: 2 },
        { tier: 3, kind: "cotton", seedCost: 3, durationMinutes: 72 * 60, points: 4 },
      ],
    });
    // Legacy 3-tier gets upgraded to 6-tier differentiated defaults
    assert.equal(merged.tiers.length, 6);
    assert.equal(merged.tiers[0]?.kind, "corn");
    assert.equal(merged.tiers[1]?.kind, "cotton");
    assert.equal(merged.tiers[2]?.kind, "tomato");
    assert.equal(merged.tiers[3]?.kind, "strawberry");
    assert.equal(merged.tiers[4]?.kind, "pumpkin");
    assert.equal(merged.tiers[5]?.kind, "sunflower");
  });

  it("keeps a parent-edited 5-tier crop economy", () => {
    const merged = mergeGameConfig({
      tiers: [
        { tier: 1, seedCost: 4, durationMinutes: 90, points: 10, shardRefund: 1 },
        { tier: 2, seedCost: 5, durationMinutes: 120, points: 12, shardRefund: 2 },
        { tier: 3, seedCost: 6, durationMinutes: 180, points: 14, shardRefund: 3 },
        { tier: 4, seedCost: 7, durationMinutes: 240, points: 16, shardRefund: 4 },
        { tier: 5, seedCost: 8, durationMinutes: 300, points: 18, shardRefund: 5 },
      ],
    });
    assert.equal(merged.tiers[0]?.seedCost, 4);
    assert.equal(merged.tiers[0]?.durationMinutes, 90);
    assert.equal(merged.tiers[0]?.points, 10);
    assert.equal(merged.tiers[4]?.points, 18);
  });

  it("defaults Wanted poster dwell to 18s and clamps 5–120", () => {
    assert.equal(DEFAULT_GAME_CONFIG.jobBoardPosterDwellSeconds, 18);
    assert.equal(mergeGameConfig({}).jobBoardPosterDwellSeconds, 18);
    assert.equal(mergeGameConfig({ jobBoardPosterDwellSeconds: 30 }).jobBoardPosterDwellSeconds, 30);
    assert.equal(mergeGameConfig({ jobBoardPosterDwellSeconds: 4.2 }).jobBoardPosterDwellSeconds, 5);
    assert.equal(mergeGameConfig({ jobBoardPosterDwellSeconds: 200 }).jobBoardPosterDwellSeconds, 120);
  });
});
