import assert from "node:assert/strict";
import test from "node:test";
import {
  cropBit,
  distinctCrops,
  evaluateUnlocks,
  medalsEarned,
  nextStep,
  seasonKeyFromParts,
  seasonLabel,
  unlockKey,
  CROP_EXPLORER_STEPS,
  MEDAL_STEPS,
  LIFETIME_SEASON_KEY,
} from "./accolades.js";

const empty = {
  harvests: 0,
  waterings: 0,
  plantings: 0,
  selfies: 0,
  chorePhotos: 0,
  cropsMask: 0,
  activeDays: 0,
};

test("season key is a Chicago calendar quarter", () => {
  assert.equal(seasonKeyFromParts(2026, 9), "2026-Q3");
  assert.equal(seasonLabel("2026-Q3"), "Jul–Sep 2026");
});

test("First Harvest unlocks at one harvest and does not grant extra medals", () => {
  const fresh = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: { ...empty, harvests: 1, cropsMask: cropBit("corn"), activeDays: 1 },
    lifetime: { ...empty, harvests: 1, cropsMask: cropBit("corn"), activeDays: 1 },
    existingKeys: [],
  });
  assert.ok(fresh.some((u) => u.slug === "first-harvest" && u.kind === "lifetime"));
  assert.equal(fresh.some((u) => u.slug === "harvests" && u.medal === "bronze"), false);
  assert.ok(fresh.some((u) => u.slug === "crops" && u.medal === "bronze"));
});

test("Harvester bronze unlocks at 10 seasonal harvests", () => {
  const fresh = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: { ...empty, harvests: 10 },
    lifetime: { ...empty, harvests: 10 },
    existingKeys: [unlockKey({ kind: "lifetime", slug: "first-harvest", medal: null, seasonKey: LIFETIME_SEASON_KEY })],
  });
  assert.ok(fresh.some((u) => u.slug === "harvests" && u.medal === "bronze"));
  assert.equal(fresh.some((u) => u.slug === "harvests" && u.medal === "silver"), false);
});

test("Homestead Helper stays locked under 500 waters", () => {
  const fresh = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: { ...empty, waterings: 12 },
    lifetime: { ...empty, waterings: 12 },
    existingKeys: [],
  });
  assert.equal(fresh.some((u) => u.slug === "homestead-helper"), false);
  assert.ok(fresh.some((u) => u.slug === "waterings" && u.medal === "bronze"));
});

test("Homestead Helper unlocks at 500 lifetime waters", () => {
  const fresh = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: { ...empty, waterings: 20 },
    lifetime: { ...empty, waterings: 500 },
    existingKeys: [],
  });
  assert.ok(fresh.some((u) => u.slug === "homestead-helper"));
});

test("Barn Full needs all three crops; Camera Kid needs 50 photos", () => {
  const almost = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: empty,
    lifetime: { ...empty, cropsMask: cropBit("corn") | cropBit("strawberry"), selfies: 20, chorePhotos: 29 },
    existingKeys: [],
  });
  assert.equal(almost.some((u) => u.slug === "barn-full"), false);
  assert.equal(almost.some((u) => u.slug === "camera-kid"), false);
  const done = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: empty,
    lifetime: {
      ...empty,
      cropsMask: cropBit("corn") | cropBit("strawberry") | cropBit("cotton"),
      selfies: 20,
      chorePhotos: 30,
    },
    existingKeys: [],
  });
  assert.ok(done.some((u) => u.slug === "barn-full"));
  assert.ok(done.some((u) => u.slug === "camera-kid"));
  assert.equal(distinctCrops(7), 3);
});

test("already-owned unlocks are not emitted again", () => {
  const key = unlockKey({ kind: "lifetime", slug: "first-harvest", medal: null, seasonKey: LIFETIME_SEASON_KEY });
  const fresh = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: { ...empty, harvests: 1 },
    lifetime: { ...empty, harvests: 4 },
    existingKeys: [key],
  });
  assert.equal(fresh.some((u) => u.slug === "first-harvest"), false);
});

test("seasonal medals re-award on a new seasonKey", () => {
  const old = unlockKey({ kind: "seasonal", slug: "harvests", medal: "bronze", seasonKey: "2026-Q2" });
  const fresh = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: { ...empty, harvests: 10 },
    lifetime: { ...empty, harvests: 10 },
    existingKeys: [old],
  });
  assert.ok(fresh.some((u) => u.slug === "harvests" && u.medal === "bronze" && u.seasonKey === "2026-Q3"));
});

test("Early Bird is 30 distinct days, not 29", () => {
  const almost = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: empty,
    lifetime: { ...empty, activeDays: 29 },
    existingKeys: [],
  });
  assert.equal(almost.some((u) => u.slug === "early-bird"), false);
  const done = evaluateUnlocks({
    seasonKey: "2026-Q3",
    seasonal: empty,
    lifetime: { ...empty, activeDays: 30 },
    existingKeys: [],
  });
  assert.ok(done.some((u) => u.slug === "early-bird"));
});

test("next medal remaining math", () => {
  assert.deepEqual(medalsEarned(10, MEDAL_STEPS), ["bronze"]);
  assert.equal(nextStep(10, MEDAL_STEPS).remaining, 40);
  assert.equal(nextStep(3, CROP_EXPLORER_STEPS).done, true);
});
