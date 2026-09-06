import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GAME_CONFIG, PLOTS_PER_GARDEN } from "@farmhand/shared";
import { ensurePlots, wateringState } from "./game.js";

describe("ensurePlots", () => {
  it("pads a leftover 6-plot garden to nine slots", () => {
    const plots = ensurePlots([{ slot: 0 }, { slot: 2 }, { slot: 5 }], PLOTS_PER_GARDEN);
    assert.equal(plots.length, 9);
    assert.deepEqual(plots.map((p) => p.slot), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(plots[1]?.slot, 1);
    assert.equal(plots[5]?.slot, 5);
    assert.equal(plots[8]?.slot, 8);
  });
});

describe("wateringState", () => {
  it("resets the daily cap on a new Chicago day", () => {
    const player = {
      lastWateredAt: new Date("2026-01-01T10:00:00.000Z"),
      wateringsOnDate: "2026-01-01",
      wateringsCount: 3,
    };
    const now = new Date("2026-01-02T12:00:00.000Z");
    const state = wateringState(player, DEFAULT_GAME_CONFIG, now);
    assert.equal(state.wateringsUsed, 0);
    assert.equal(state.wateringsLeft, 3);
  });

  it("enforces cooldown from lastWateredAt", () => {
    const now = new Date("2026-06-01T18:00:00.000Z");
    const player = {
      lastWateredAt: new Date(now.getTime() - 60 * 60 * 1000),
      wateringsOnDate: "2026-06-01",
      wateringsCount: 1,
    };
    const state = wateringState(player, DEFAULT_GAME_CONFIG, now);
    assert.equal(state.canWater, false);
    assert.ok(state.cooldownRemainingMs > 0);
  });
});
