import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GAME_CONFIG } from "@farmhand/shared";
import { wateringState } from "./game.js";

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
