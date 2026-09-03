import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_GAME_CONFIG } from "./config.js";
import { growthStage, maturityDate, serializePlot } from "./engine.js";

describe("maturityDate", () => {
  it("subtracts water and fertilizer reductions from the tier duration", () => {
    const plantedAt = new Date("2026-01-01T00:00:00.000Z");
    const tier = DEFAULT_GAME_CONFIG.tiers[0];
    const matures = maturityDate(
      {
        slot: 0,
        plantTier: 1,
        plantedAt,
        waterReductionMinutes: 60,
        fertilizerReductionMinutes: 4 * 60,
      },
      tier,
    );
    assert.ok(matures);
    const expectedMs = plantedAt.getTime() + (24 * 60 - 60 - 4 * 60) * 60 * 1000;
    assert.equal(matures.getTime(), expectedMs);
  });

  it("can mature immediately when reductions exceed duration", () => {
    const plantedAt = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-01-01T00:00:01.000Z");
    const plot = serializePlot(
      {
        slot: 2,
        plantTier: 1,
        plantedAt,
        waterReductionMinutes: 20 * 60,
        fertilizerReductionMinutes: 10 * 60,
      },
      DEFAULT_GAME_CONFIG,
      now,
    );
    assert.equal(plot.state, "mature");
    assert.equal(plot.ready, true);
    assert.equal(plot.remainingMs, 0);
  });
});

describe("growthStage", () => {
  it("splits growing time into four distinct stages", () => {
    const plantedAt = new Date("2026-01-01T00:00:00.000Z");
    const maturesAt = new Date("2026-01-01T04:00:00.000Z");
    assert.equal(growthStage(plantedAt, maturesAt, new Date("2026-01-01T00:10:00.000Z")), 1);
    assert.equal(growthStage(plantedAt, maturesAt, new Date("2026-01-01T01:10:00.000Z")), 2);
    assert.equal(growthStage(plantedAt, maturesAt, new Date("2026-01-01T02:10:00.000Z")), 3);
    assert.equal(growthStage(plantedAt, maturesAt, new Date("2026-01-01T03:10:00.000Z")), 4);
    assert.equal(growthStage(plantedAt, maturesAt, new Date("2026-01-01T04:00:00.000Z")), 4);
  });
});

describe("serializePlot", () => {
  it("returns empty for an unused plot", () => {
    const plot = serializePlot(
      {
        slot: 1,
        plantTier: null,
        plantedAt: null,
        waterReductionMinutes: 0,
        fertilizerReductionMinutes: 0,
      },
      DEFAULT_GAME_CONFIG,
    );
    assert.equal(plot.state, "empty");
    assert.equal(plot.emoji, null);
  });

  it("uses distinct stage emojis while growing", () => {
    const plantedAt = new Date("2026-01-01T00:00:00.000Z");
    const now = new Date("2026-01-01T02:00:00.000Z");
    const plot = serializePlot(
      {
        slot: 0,
        plantTier: 1,
        plantedAt,
        waterReductionMinutes: 0,
        fertilizerReductionMinutes: 0,
      },
      DEFAULT_GAME_CONFIG,
      now,
    );
    assert.equal(plot.state, "growing");
    assert.equal(plot.emoji, "🌱");
    assert.equal(plot.face, "😌");
  });
});
