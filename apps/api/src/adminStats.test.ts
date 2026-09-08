import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_CONFIG } from "@farmhand/shared";
import {
  cropMixForAction,
  cropMixFromPlots,
  dailySeries,
  economyFromLogs,
  playerComparison,
  windowStats,
} from "./adminStats.ts";

const tz = "America/Chicago";

function log(
  action: string,
  at: string,
  extra: { playerId?: string | null; details?: unknown } = {},
) {
  return {
    action,
    playerId: extra.playerId ?? "p1",
    createdAt: new Date(at),
    details: extra.details ?? null,
  };
}

test("crop mix counts plants and harvests by corn/strawberry/cotton", () => {
  const logs = [
    log("plant", "2026-09-01T12:00:00Z", { details: { tier: 1 } }),
    log("plant", "2026-09-01T13:00:00Z", { details: { tier: 1 } }),
    log("plant", "2026-09-01T14:00:00Z", { details: { tier: 2 } }),
    log("harvest", "2026-09-02T12:00:00Z", { details: { tier: 3, points: 4, seedsReturned: 1 } }),
  ];
  const planted = cropMixForAction(logs, "plant");
  assert.equal(planted.total, 3);
  assert.equal(planted.counts.corn, 2);
  assert.equal(planted.counts.strawberry, 1);
  assert.equal(planted.pct.corn, 66.7);
  const harvested = cropMixForAction(logs, "harvest");
  assert.equal(harvested.counts.cotton, 1);
  assert.equal(harvested.pct.cotton, 100);
});

test("in-ground mix uses live plot tiers", () => {
  const mix = cropMixFromPlots([1, 1, 2, null, 3]);
  assert.equal(mix.total, 4);
  assert.equal(mix.counts.corn, 2);
  assert.equal(mix.counts.strawberry, 1);
  assert.equal(mix.counts.cotton, 1);
});

test("daily series buckets harvests, waterings, and logins", () => {
  const at = new Date("2026-09-08T18:00:00Z");
  const logs = [
    log("login", "2026-09-08T10:00:00Z"),
    log("watering", "2026-09-08T11:00:00Z"),
    log("harvest", "2026-09-07T11:00:00Z"),
    log("plant", "2026-09-06T11:00:00Z", { details: { tier: 2 } }),
  ];
  const series = dailySeries(logs, tz, 3, at);
  assert.equal(series.length, 3);
  assert.equal(series[2]!.logins, 1);
  assert.equal(series[2]!.waterings, 1);
  assert.equal(series[1]!.harvests, 1);
  assert.equal(series[0]!.plants, 1);
});

test("economy tracks seed spend vs harvest return", () => {
  const logs = [
    log("plant", "2026-09-01T12:00:00Z", { details: { tier: 2 } }),
    log("plant", "2026-09-01T12:00:00Z", { details: { tier: 3 } }),
    log("harvest", "2026-09-02T12:00:00Z", { details: { tier: 2, points: 2, seedsReturned: 1 } }),
    log("watering", "2026-09-02T13:00:00Z"),
    log("login", "2026-09-02T09:00:00Z"),
  ];
  const eco = economyFromLogs(logs, DEFAULT_GAME_CONFIG);
  assert.equal(eco.plants, 2);
  assert.equal(eco.seedsSpent, 5);
  assert.equal(eco.seedsReturned, 1);
  assert.equal(eco.netSeeds, -4);
  assert.equal(eco.pointsAwarded, 2);
  assert.equal(eco.waterings, 1);
  assert.equal(eco.logins, 1);
});

test("per-player comparison splits activity", () => {
  const logs = [
    log("harvest", "2026-09-01T12:00:00Z", { playerId: "willow" }),
    log("harvest", "2026-09-01T13:00:00Z", { playerId: "willow" }),
    log("login", "2026-09-01T09:00:00Z", { playerId: "finn" }),
  ];
  const rows = playerComparison(
    [
      { id: "willow", name: "Willow" },
      { id: "finn", name: "Finn" },
    ],
    logs,
  );
  assert.equal(rows[0]!.harvests, 2);
  assert.equal(rows[1]!.logins, 1);
  assert.equal(rows[1]!.harvests, 0);
});

test("window stats expose planted vs harvested mix", () => {
  const logs = [
    log("plant", "2026-09-01T12:00:00Z", { details: { tier: 1 } }),
    log("harvest", "2026-09-02T12:00:00Z", { details: { tier: 1, points: 1 } }),
  ];
  const stats = windowStats(logs, DEFAULT_GAME_CONFIG);
  assert.equal(stats.cropMixPlanted.counts.corn, 1);
  assert.equal(stats.cropMixHarvested.counts.corn, 1);
  assert.equal(stats.economy.harvests, 1);
});
