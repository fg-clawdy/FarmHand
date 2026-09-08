import assert from "node:assert/strict";
import test from "node:test";
import type { PublicPlot } from "@farmhand/shared";
import {
  cropNameForPlot,
  cheapestSeedCost,
  gardenMoundLocal,
  gardenMoundUv,
  gardenMoundWorld,
  gardenPlayfieldFit,
  GARDEN_CAMERA_ZOOM,
  GARDEN_CROP_SEAT,
  GARDEN_MOUND_PX,
  GARDEN_TOOL_ART,
  GARDEN_ZOOM_LAYOUT,
  GARDEN_ZOOM_TEXTURE,
  glowingSlots,
  plotAcceptsTool,
  gardenTapAction,
  PLOTS_PER_GARDEN,
} from "./gardenLayout.ts";
import { cameraFit } from "./draw.ts";
import { uvToLocal } from "./playfieldLayout.ts";

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
  assert.equal(GARDEN_MOUND_PX.length, PLOTS_PER_GARDEN);
  assert.equal(PLOTS_PER_GARDEN, 9);
  const slots = Array.from({ length: 9 }, (_, i) => gardenMoundUv(i));
  assert.ok(slots[0]!.u < slots[1]!.u && slots[1]!.u < slots[2]!.u);
  assert.ok(slots[0]!.v < slots[3]!.v && slots[3]!.v < slots[6]!.v);
  for (const uv of slots) {
    assert.ok(uv.u > 0.22 && uv.u < 0.78);
    assert.ok(uv.v > 0.26 && uv.v < 0.78);
  }
  assert.ok(Math.abs(slots[4]!.u - 0.5) < 0.02);
  assert.ok(slots[0]!.v > 0.26 && slots[0]!.v < 0.36, "back row sits on the painted mounds");
});

test("mound pixels are the placement source of truth", () => {
  for (let slot = 0; slot < 9; slot++) {
    const px = gardenMoundLocal(slot);
    assert.deepEqual(px, GARDEN_MOUND_PX[slot]);
    const local = uvToLocal(gardenMoundUv(slot), GARDEN_ZOOM_TEXTURE.width, GARDEN_ZOOM_TEXTURE.height);
    assert.ok(Math.abs(local.x - px.x) < 1e-9);
    assert.ok(Math.abs(local.y - px.y) < 1e-9);
  }
  assert.equal(gardenMoundLocal(4).x, 768);
  assert.equal(gardenMoundLocal(4).y, 541);
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

test("plot sheet names the crop, never a plot index", () => {
  const growing = plot(4, "growing", { tier: 1 });
  const berry = plot(0, "growing", { tier: 2 });
  const cotton = plot(8, "mature", { tier: 3 });
  const tiers = [
    { tier: 1, name: "Sweet Corn" },
    { tier: 2, name: "Strawberry" },
    { tier: 3, name: "Cotton" },
  ];
  assert.equal(cropNameForPlot(growing, tiers), "Sweet Corn");
  assert.equal(cropNameForPlot(berry, tiers), "Strawberry");
  assert.equal(cropNameForPlot(cotton, tiers), "Cotton");
  assert.equal(cropNameForPlot(plot(2, "growing", { tier: 1 }), []), "Corn");
  assert.ok(!cropNameForPlot(growing, tiers).toLowerCase().includes("plot"));
  assert.ok(!String(growing.slot).includes(cropNameForPlot(growing, tiers)));
});

test("garden camera pulls out to 85% of cover-fit", () => {
  assert.equal(GARDEN_CAMERA_ZOOM, 0.85);
});

test("garden crop seat is a small playfield nudge onto the pebble ring", () => {
  assert.ok(GARDEN_CROP_SEAT.x > 0 && GARDEN_CROP_SEAT.x < 40);
  assert.ok(GARDEN_CROP_SEAT.y >= 0 && GARDEN_CROP_SEAT.y < 24);
});

test("mound UVs stay in texture space; zoom only scales the shared playfield", () => {
  const uv = gardenMoundUv(4);
  const local = uvToLocal(uv, GARDEN_ZOOM_TEXTURE.width, GARDEN_ZOOM_TEXTURE.height);
  for (const zoom of [1, 0.9, 0.85, 0.7]) {
    for (const [w, h] of [
      [1536, 1024],
      [1920, 1080],
    ] as const) {
      const fit = cameraFit(w, h, 1536, 1024, zoom);
      const world = { x: fit.x + local.x * fit.scale, y: fit.y + local.y * fit.scale };
      assert.ok(Math.abs((world.x - fit.x) / fit.scale - local.x) < 1e-6);
      assert.ok(Math.abs((world.y - fit.y) / fit.scale - local.y) < 1e-6);
    }
  }
});

/** Tablet / phone viewports — landscape and the same pair flipped to portrait. */
const ORIENTATION_VIEWPORTS = [
  [1280, 800],
  [800, 1280],
  [1920, 1080],
  [1080, 1920],
  [1024, 768],
  [768, 1024],
  [1180, 820],
  [820, 1180],
  [390, 844],
  [844, 390],
] as const;

test("mound locals never change when the viewport or orientation changes", () => {
  const locked = Array.from({ length: 9 }, (_, slot) => gardenMoundLocal(slot));
  for (const [w, h] of ORIENTATION_VIEWPORTS) {
    for (let slot = 0; slot < 9; slot++) {
      const world = gardenMoundWorld(slot, w, h);
      assert.deepEqual(world.local, locked[slot]);
      assert.equal(world.local.x, GARDEN_MOUND_PX[slot]!.x);
      assert.equal(world.local.y, GARDEN_MOUND_PX[slot]!.y);
    }
  }
});

test("cameraFit maps the same playfield local to screen on every orientation", () => {
  for (const [w, h] of ORIENTATION_VIEWPORTS) {
    const fit = gardenPlayfieldFit(w, h);
    assert.ok(fit.scale * GARDEN_ZOOM_TEXTURE.width <= w + 0.5);
    assert.ok(fit.scale * GARDEN_ZOOM_TEXTURE.height <= h + 0.5);
    for (let slot = 0; slot < 9; slot++) {
      const world = gardenMoundWorld(slot, w, h);
      const back = {
        x: (world.x - fit.x) / fit.scale,
        y: (world.y - fit.y) / fit.scale,
      };
      assert.ok(Math.abs(back.x - world.local.x) < 1e-6, `${w}x${h} slot ${slot} x`);
      assert.ok(Math.abs(back.y - world.local.y) < 1e-6, `${w}x${h} slot ${slot} y`);
    }
  }
});

test("flipping landscape to portrait does not move plants in playfield space", () => {
  const pairs = [
    [1280, 800],
    [1024, 768],
    [1920, 1080],
  ] as const;
  for (const [w, h] of pairs) {
    const land = gardenMoundWorld(4, w, h);
    const port = gardenMoundWorld(4, h, w);
    assert.deepEqual(land.local, port.local);
    assert.ok(land.fit.scale !== port.fit.scale || land.fit.x !== port.fit.x || land.fit.y !== port.fit.y);
    assert.ok(Math.abs(land.x - (land.fit.x + land.local.x * land.fit.scale)) < 1e-9);
    assert.ok(Math.abs(port.x - (port.fit.x + port.local.x * port.fit.scale)) < 1e-9);
  }
});

test("READY plots harvest on tap; empty and growing keep picker/sheet/tools", () => {
  const growing = plot(1, "growing");
  const ripe = plot(2, "mature");
  const empty = plot(0, "empty");
  const ctx = { seeds: 10, fertilizer: 1, canWater: true, cheapestSeed: 1 };
  assert.equal(gardenTapAction(ripe, null, ctx), "harvest");
  assert.equal(gardenTapAction(ripe, "water", ctx), "harvest");
  assert.equal(gardenTapAction(ripe, "seed", ctx), "harvest");
  assert.equal(gardenTapAction(ripe, "fert", ctx), "harvest");
  assert.equal(gardenTapAction(empty, null, ctx), "picker");
  assert.equal(gardenTapAction(empty, "seed", ctx), "picker");
  assert.equal(gardenTapAction(empty, "water", ctx), "noop");
  assert.equal(gardenTapAction(growing, null, ctx), "sheet");
  assert.equal(gardenTapAction(growing, "water", ctx), "water");
  assert.equal(gardenTapAction(growing, "fert", ctx), "fert");
});
