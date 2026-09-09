import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GAME_CONFIG, PLOTS_PER_GARDEN } from "@farmhand/shared";
import { ensurePlots, plotWateringState, selfieUnlockedOn, wateringState } from "./game.js";

describe("ensurePlots", () => {
  it("pads a leftover 6-plot garden to nine slots", () => {
    const plots = ensurePlots([{ slot: 0 }, { slot: 2 }, { slot: 5 }], PLOTS_PER_GARDEN);
    assert.equal(plots.length, 9);
    assert.deepEqual(plots.map((plot) => plot.slot), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(plots[1]?.slot, 1);
    assert.equal(plots[5]?.slot, 5);
    assert.equal(plots[8]?.slot, 8);
  });
});

describe("selfie unlock", () => {
  it("is only true on that Chicago day", () => {
    const now = new Date("2026-01-02T12:00:00.000Z");
    assert.equal(selfieUnlockedOn("2026-01-02", "America/Chicago", now), true);
    assert.equal(selfieUnlockedOn("2026-01-01", "America/Chicago", now), false);
    assert.equal(selfieUnlockedOn(null, "America/Chicago", now), false);
  });
});

describe("plotWateringState", () => {
  it("resets the per-plant daily cap on a new Chicago day", () => {
    const now = new Date("2026-01-02T12:00:00.000Z");
    const state = plotWateringState(
      {
        lastWateredAt: new Date("2026-01-01T10:00:00.000Z"),
        wateringsOnDate: "2026-01-01",
        wateringsCount: 3,
      },
      DEFAULT_GAME_CONFIG,
      now,
    );
    assert.equal(state.wateringsUsed, 0);
    assert.equal(state.wateringsLeft, 3);
    assert.equal(state.canWater, true);
  });

  it("enforces a 4h cooldown on that plant", () => {
    const now = new Date("2026-06-01T18:00:00.000Z");
    const state = plotWateringState(
      {
        lastWateredAt: new Date(now.getTime() - 60 * 60 * 1000),
        wateringsOnDate: "2026-06-01",
        wateringsCount: 1,
      },
      DEFAULT_GAME_CONFIG,
      now,
    );
    assert.equal(state.canWater, false);
    assert.ok(state.cooldownRemainingMs > 0);
  });

  it("blocks a fourth water the same Chicago day", () => {
    const now = new Date("2026-06-01T23:00:00.000Z");
    const state = plotWateringState(
      {
        lastWateredAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
        wateringsOnDate: "2026-06-01",
        wateringsCount: 3,
      },
      DEFAULT_GAME_CONFIG,
      now,
    );
    assert.equal(state.wateringsLeft, 0);
    assert.equal(state.canWater, false);
  });
});

describe("wateringState", () => {
  it("stays locked without today's selfie even if a plant could take water", () => {
    const now = new Date("2026-01-02T12:00:00.000Z");
    const plantedAt = new Date("2026-01-02T06:00:00.000Z");
    const state = wateringState(
      {
        selfieUnlockDate: null,
        plots: [
          {
            slot: 0,
            plantTier: 1,
            plantedAt,
            lastWateredAt: null,
            wateringsOnDate: null,
            wateringsCount: 0,
            waterReductionMinutes: 0,
            fertilizerReductionMinutes: 0,
          },
        ],
      },
      DEFAULT_GAME_CONFIG,
      now,
    );
    assert.equal(state.unlocked, false);
    assert.equal(state.canWater, false);
    assert.equal(state.wateringsLeft, 0);
  });

  it("allows water after selfie unlock when the plant is under caps", () => {
    const now = new Date("2026-01-02T12:00:00.000Z");
    const plantedAt = new Date("2026-01-02T06:00:00.000Z");
    const state = wateringState(
      {
        selfieUnlockDate: "2026-01-02",
        selfieSeedGrantDate: "2026-01-02",
        plots: [
          {
            slot: 0,
            plantTier: 1,
            plantedAt,
            lastWateredAt: null,
            wateringsOnDate: null,
            wateringsCount: 0,
            waterReductionMinutes: 0,
            fertilizerReductionMinutes: 0,
          },
        ],
      },
      DEFAULT_GAME_CONFIG,
      now,
    );
    assert.equal(state.unlocked, true);
    assert.equal(state.canWater, true);
    assert.equal(state.wateringsLeft, 3);
  });
});
