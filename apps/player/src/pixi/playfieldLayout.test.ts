import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYFIELD_LAYOUT,
  PLAYFIELD_TEXTURE,
  cowRoamAvoidsGardens,
  facingFromDx,
  gardenSignName,
  moundUv,
  pickRoamTarget,
  pointInRect,
  uvRectToLocal,
  uvToLocal,
} from "./playfieldLayout.ts";

test("exhaust and signs are documented in texture UV space", () => {
  const { exhaustTip, gardens } = PLAYFIELD_LAYOUT;
  assert.ok(exhaustTip.u > 0.26 && exhaustTip.u < 0.28);
  assert.ok(exhaustTip.v > 0.24 && exhaustTip.v < 0.27);
  assert.equal(gardens.length, 3);
  assert.deepEqual(
    gardens.map((g) => Number(g.sign.u.toFixed(3))),
    [0.163, 0.495, 0.795],
  );
});

test("cover-fit local pixels match the 1536×1024 painting", () => {
  const tip = uvToLocal(PLAYFIELD_LAYOUT.exhaustTip, PLAYFIELD_TEXTURE.width, PLAYFIELD_TEXTURE.height);
  assert.equal(Math.round(tip.x), 419);
  assert.equal(Math.round(tip.y), 258);
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

test("six playable mounds sit on the front two soil rows", () => {
  const soil = PLAYFIELD_LAYOUT.gardens[0].soil;
  const slots = [0, 1, 2, 3, 4, 5].map((slot) => moundUv(soil, slot));
  assert.ok(slots[0].u < slots[1].u && slots[1].u < slots[2].u);
  assert.ok(slots[0].v < slots[3].v, "slot 0 is the back row, slot 3 the front");
  for (const uv of slots) {
    assert.ok(uv.u > soil.u0 && uv.u < soil.u1);
    assert.ok(uv.v > soil.v0 && uv.v < soil.v1);
  }
});

test("right-facing cow sheet flips via scale.x when roaming left", () => {
  assert.equal(facingFromDx(12, 1), 1);
  assert.equal(facingFromDx(-8, 1), -1);
  assert.equal(facingFromDx(0, -1), -1, "hold last facing on a vertical step");
});
