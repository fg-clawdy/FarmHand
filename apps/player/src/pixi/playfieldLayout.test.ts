import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYFIELD_LAYOUT,
  PLAYFIELD_TEXTURE,
  cowRoamAvoidsGardens,
  gardenSignName,
  pickRoamTarget,
  pointInRect,
  uvRectToLocal,
  uvToLocal,
} from "./playfieldLayout.ts";

test("exhaust and signs are documented in texture UV space", () => {
  const { exhaustTip, gardens } = PLAYFIELD_LAYOUT;
  assert.ok(exhaustTip.u > 0.2 && exhaustTip.u < 0.35);
  assert.ok(exhaustTip.v > 0.25 && exhaustTip.v < 0.38);
  assert.equal(gardens.length, 3);
  assert.deepEqual(
    gardens.map((g) => Number(g.sign.u.toFixed(3))),
    [0.163, 0.495, 0.795],
  );
});

test("cover-fit local pixels match the 1536×1024 painting", () => {
  const tip = uvToLocal(PLAYFIELD_LAYOUT.exhaustTip, PLAYFIELD_TEXTURE.width, PLAYFIELD_TEXTURE.height);
  assert.equal(Math.round(tip.x), 430);
  assert.equal(Math.round(tip.y), 326);
});

test("cow roam box never overlaps the three garden plots", () => {
  assert.equal(cowRoamAvoidsGardens(), true);
  const roam = uvRectToLocal(PLAYFIELD_LAYOUT.cowRoam, 1536, 1024);
  const gardens = PLAYFIELD_LAYOUT.gardens.map((g) => uvRectToLocal(g.hit, 1536, 1024));
  const target = pickRoamTarget(roam, gardens, () => 0.5);
  assert.equal(
    gardens.some((rect) => pointInRect(target.x, target.y, rect)),
    false,
  );
});

test("sign overlays use the live child name from farm/admin data", () => {
  assert.equal(gardenSignName("Willow"), "Willow");
  assert.equal(gardenSignName("  Finn  "), "Finn");
  assert.equal(gardenSignName(""), "Garden");
});
