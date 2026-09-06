import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GAME_CONFIG, mergeGameConfig } from "./config.js";
import { cropKindForTier, PLOTS_PER_GARDEN } from "./types.js";

describe("v1 crop kinds", () => {
  it("maps three tiers to corn, strawberry, and cotton", () => {
    assert.deepEqual(
      DEFAULT_GAME_CONFIG.tiers.map((t) => t.kind),
      ["corn", "strawberry", "cotton"],
    );
    assert.equal(cropKindForTier(1), "corn");
    assert.equal(cropKindForTier(2), "strawberry");
    assert.equal(cropKindForTier(3), "cotton");
    assert.equal(cropKindForTier(9), "cotton");
  });

  it("swaps leftover fantasy names to the v1 crops while keeping tunables", () => {
    const merged = mergeGameConfig({
      tiers: [
        { tier: 1, name: "Prairie Daisy", seedCost: 7, durationMinutes: 12, points: 9, fertilizerReductionMinutes: 3 },
        { tier: 2, name: "Kitchen Herbs", seedCost: 8, durationMinutes: 22, points: 11, fertilizerReductionMinutes: 5 },
        { tier: 3, name: "Sunflower", seedCost: 9, durationMinutes: 32, points: 13, fertilizerReductionMinutes: 7 },
        { tier: 4, name: "Homestead Oak", seedCost: 10, durationMinutes: 42, points: 15, fertilizerReductionMinutes: 9 },
      ],
    });
    assert.equal(merged.tiers.length, 3);
    assert.equal(merged.tiers[0]?.name, "Sweet Corn");
    assert.equal(merged.tiers[0]?.kind, "corn");
    assert.equal(merged.tiers[0]?.seedCost, 7);
    assert.equal(merged.tiers[1]?.kind, "strawberry");
    assert.equal(merged.tiers[2]?.kind, "cotton");
    assert.equal(merged.tiers[2]?.points, 13);
  });

  it("raises leftover 6-plot gardens to a full 3×3", () => {
    const merged = mergeGameConfig({ plotCount: 6 });
    assert.equal(merged.plotCount, PLOTS_PER_GARDEN);
    assert.equal(DEFAULT_GAME_CONFIG.plotCount, 9);
  });
});
