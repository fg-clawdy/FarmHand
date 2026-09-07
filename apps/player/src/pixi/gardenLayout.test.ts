import assert from "node:assert/strict";
import test from "node:test";
import type { PublicPlot } from "@farmhand/shared";
import {
  cheapestSeedCost,
  gardenMoundUv,
  GARDEN_TOOL_ART,
  GARDEN_ZOOM_LAYOUT,
  glowingSlots,
  plotAcceptsTool,
  PLOTS_PER_GARDEN,
} from "./gardenLayout.ts";

function plot(slot: number, state: PublicPlot["state"], extra: Partial<PublicPlot> = {}): PublicPlot {
  return {
    slot,
    state,
    tier: state === "empty" ? null : 1,
    plantedAt: state === "empty" ? null : "2026-01-01T00:00:00.000Z",
    maturesAt: state === "empty" ? null : "2026-01-02T00:00:00.000Z",
    remainingMs: state === "mature" ? 0 : 3_600_000,
    growthStage: state === "empty" ? null : 2,
    emoji: null,
    face: null,
    ready: state === "mature",
    ...extra,
  };
}

test("zoomed garden has nine mound UVs inside the dirt", () => {
  assert.equal(GARDEN_ZOOM_LAYOUT.mounds.length, PLOTS_PER_GARDEN);
  assert.equal(PLOTS_PER_GARDEN, 9);
  const slots = Array.from({ length: 9 }, (_, i) => gardenMoundUv(i));
  assert.ok(slots[0]!.u < slots[1]!.u && slots[1]!.u < slots[2]!.u);
  assert.ok(slots[0]!.v < slots[3]!.v && slots[3]!.v < slots[6]!.v);
  for (const uv of slots) {
    assert.ok(uv.u > 0.2 && uv.u < 0.8);
    assert.ok(uv.v > 0.25 && uv.v < 0.85);
  }
});

test("tool art stays PNG with real alpha paths", () => {
  assert.ok(GARDEN_TOOL_ART.seed.endsWith(".png"));
  assert.ok(GARDEN_TOOL_ART.water.endsWith(".png"));
  assert.ok(GARDEN_TOOL_ART.fert.endsWith(".png"));
});

test("glow eligibility: seeds only empty plots the kid can afford", () => {
  const plots = [plot(0, "empty"), plot(1, "growing"), plot(2, "mature")];
  const broke = { seeds: 0, fertilizer: 2, canWater: true, cheapestSeed: 1 };
  const rich = { seeds: 10, fertilizer: 2, canWater: true, cheapestSeed: 1 };
  assert.deepEqual(glowingSlots("seed", plots, broke), []);
  assert.deepEqual(glowingSlots("seed", plots, rich), [0]);
  assert.equal(plotAcceptsTool("seed", plots[0]!, rich), true);
  assert.equal(plotAcceptsTool("seed", plots[1]!, rich), false);
});

test("glow eligibility: water and fert only growing (not ready) plots with inventory", () => {
  const plots = [plot(0, "empty"), plot(1, "growing"), plot(2, "mature")];
  const can = { seeds: 10, fertilizer: 1, canWater: true, cheapestSeed: 1 };
  const dry = { seeds: 10, fertilizer: 1, canWater: false, cheapestSeed: 1 };
  const noFert = { seeds: 10, fertilizer: 0, canWater: true, cheapestSeed: 1 };
  assert.deepEqual(glowingSlots("water", plots, can), [1]);
  assert.deepEqual(glowingSlots("water", plots, dry), []);
  assert.deepEqual(glowingSlots("fert", plots, can), [1]);
  assert.deepEqual(glowingSlots("fert", plots, noFert), []);
  assert.deepEqual(glowingSlots(null, plots, can), []);
});

test("cheapest seed cost is the lowest tier", () => {
  assert.equal(
    cheapestSeedCost([
      { seedCost: 2 },
      { seedCost: 1 },
      { seedCost: 3 },
    ]),
    1,
  );
});
