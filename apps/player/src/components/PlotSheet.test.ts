import assert from "node:assert/strict";
import test from "node:test";
import type { PublicPlot } from "@farmhand/shared";
import { growthStatus, plotStatusPill } from "./PlotSheet";

function basePlot(over: Partial<PublicPlot> = {}): PublicPlot {
  return {
    slot: 0,
    state: "growing",
    tier: 1,
    plantedAt: "2026-09-20T12:00:00.000Z",
    maturesAt: "2026-09-26T12:00:00.000Z",
    remainingMs: 60_000,
    growthStage: 2,
    emoji: "🌱",
    face: null,
    ready: false,
    ...over,
  };
}

test("plotStatusPill reflects growing / ready / waiting / wilted", () => {
  assert.deepEqual(plotStatusPill(basePlot()), { label: "Growing", tone: "growing" });
  assert.deepEqual(plotStatusPill(basePlot({ ready: true, remainingMs: 0, growthStage: 4 })), {
    label: "Ready",
    tone: "ready",
  });
  assert.deepEqual(
    plotStatusPill(basePlot({ ready: true, awaitingApproval: true, remainingMs: 0, growthStage: 4 })),
    { label: "Waiting on grown-up", tone: "waiting" },
  );
  assert.deepEqual(plotStatusPill(basePlot({ state: "wilted", ready: false })), {
    label: "Wilted",
    tone: "wilted",
  });
});

test("awaitingApproval wins over ready for the header pill", () => {
  const pill = plotStatusPill(
    basePlot({ ready: true, awaitingApproval: true, remainingMs: 0, growthStage: 4 }),
  );
  assert.equal(pill.tone, "waiting");
  assert.match(pill.label, /grown-up/i);
});

test("growthStatus chip copy for ready+awaiting uses grown-up wording", () => {
  const copy = growthStatus(
    basePlot({ ready: true, awaitingApproval: true, remainingMs: 0, growthStage: 4 }),
  );
  assert.equal(copy, "Ready — waiting on a grown-up");
});

test("growthStatus for plain ready plants", () => {
  assert.equal(growthStatus(basePlot({ ready: true, remainingMs: 0, growthStage: 4 })), "Ready to harvest");
});
