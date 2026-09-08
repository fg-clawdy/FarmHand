import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_GAME_CONFIG,
  FLAT_TIER_DURATION_MINUTES,
  FLAT_TIER_POINTS,
  FLAT_TIER_SEED_COST,
  mergeGameConfig,
} from "./config.js";
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

  it("seeds the locked balance-goals text when the field is missing", () => {
    const merged = mergeGameConfig({});
    assert.equal(
      merged.balanceGoals,
      "Encourage short daily sessions with healthy watering use; avoid designs that reward only long waits or one OP crop.",
    );
  });

  it("keeps a parent-edited balance-goals string", () => {
    const merged = mergeGameConfig({ balanceGoals: "Kids should try all three crops." });
    assert.equal(merged.balanceGoals, "Kids should try all three crops.");
  });

  it("ships a flat 1 seed / 24h / 25★ table and +1 harvest seed return", () => {
    assert.equal(DEFAULT_GAME_CONFIG.harvestSeedReturn, 1);
    for (const tier of DEFAULT_GAME_CONFIG.tiers) {
      assert.equal(tier.seedCost, FLAT_TIER_SEED_COST);
      assert.equal(tier.durationMinutes, FLAT_TIER_DURATION_MINUTES);
      assert.equal(tier.points, FLAT_TIER_POINTS);
    }
  });

  it("boot-merges the old 1/2/3 seed and 1/2/4★ ladder to the flat table", () => {
    const merged = mergeGameConfig({
      tiers: [
        { tier: 1, kind: "corn", seedCost: 1, durationMinutes: 24 * 60, points: 1 },
        { tier: 2, kind: "strawberry", seedCost: 2, durationMinutes: 48 * 60, points: 2 },
        { tier: 3, kind: "cotton", seedCost: 3, durationMinutes: 72 * 60, points: 4 },
      ],
    });
    for (const tier of merged.tiers) {
      assert.equal(tier.seedCost, FLAT_TIER_SEED_COST);
      assert.equal(tier.durationMinutes, FLAT_TIER_DURATION_MINUTES);
      assert.equal(tier.points, FLAT_TIER_POINTS);
    }
    assert.equal(merged.harvestSeedReturn, 1);
  });

  it("keeps a parent-edited crop economy", () => {
    const merged = mergeGameConfig({
      tiers: [
        { tier: 1, seedCost: 4, durationMinutes: 90, points: 10 },
        { tier: 2, seedCost: 5, durationMinutes: 120, points: 12 },
        { tier: 3, seedCost: 6, durationMinutes: 180, points: 14 },
      ],
    });
    assert.equal(merged.tiers[0]?.seedCost, 4);
    assert.equal(merged.tiers[0]?.durationMinutes, 90);
    assert.equal(merged.tiers[0]?.points, 10);
    assert.equal(merged.tiers[2]?.points, 14);
  });
});
