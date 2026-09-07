import assert from "node:assert/strict";
import test from "node:test";
import {
  PLAYFIELD_LAYOUT,
  PLAYFIELD_TEXTURE,
  cowBodyHitsForbidden,
  cowForbiddenRects,
  cowRoamAvoidsGardens,
  facingFromDx,
  gardenSignName,
  gardenSignStats,
  moundUv,
  pathHitsForbidden,
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

test("cow blockers include barn, tractor, hay, stand, and gardens", () => {
  const keys = Object.keys(PLAYFIELD_LAYOUT.blockers);
  for (const key of ["barn", "hay", "tractor", "stand"]) {
    assert.ok(keys.includes(key), key);
  }
  assert.ok(!keys.includes("mamaCow"));
  assert.equal(cowForbiddenRects(1536, 1024).length, 7);
});

test("cow body cannot sit on garden soil, plaque, or fence", () => {
  const forbidden = cowForbiddenRects(1536, 1024);
  for (const garden of PLAYFIELD_LAYOUT.gardens) {
    const soil = uvToLocal({ u: (garden.soil.u0 + garden.soil.u1) / 2, v: (garden.soil.v0 + garden.soil.v1) / 2 }, 1536, 1024);
    const sign = uvToLocal(garden.sign, 1536, 1024);
    assert.equal(cowBodyHitsForbidden(soil.x, soil.y, forbidden), true, "soil");
    assert.equal(cowBodyHitsForbidden(sign.x, sign.y, forbidden), true, "plaque");
  }
});

test("cow roam box never overlaps the three garden plots", () => {
  assert.equal(cowRoamAvoidsGardens(), true);
  const roam = uvRectToLocal(PLAYFIELD_LAYOUT.cowRoam, 1536, 1024);
  const forbidden = cowForbiddenRects(1536, 1024);
  let n = 0;
  const target = pickRoamTarget(roam, forbidden, () => {
    n += 0.173;
    return n % 1;
  });
  assert.equal(cowBodyHitsForbidden(target.x, target.y, forbidden), false);
});

test("cow start sits on clear grass, not inside a blocker", () => {
  const start = uvToLocal(PLAYFIELD_LAYOUT.cowStart, 1536, 1024);
  const forbidden = cowForbiddenRects(1536, 1024);
  assert.equal(cowBodyHitsForbidden(start.x, start.y, forbidden), false);
  const roam = uvRectToLocal(PLAYFIELD_LAYOUT.cowRoam, 1536, 1024);
  assert.equal(pointInRect(start.x, start.y, roam), true);
});

test("cow body box, not just the hooves, is blocked by the tractor", () => {
  const tractor = uvRectToLocal(PLAYFIELD_LAYOUT.blockers.tractor, 1536, 1024);
  const midX = (tractor.x0 + tractor.x1) / 2;
  const midY = (tractor.y0 + tractor.y1) / 2;
  assert.equal(cowBodyHitsForbidden(midX, midY, [tractor]), true);
  const start = uvToLocal(PLAYFIELD_LAYOUT.cowStart, 1536, 1024);
  assert.equal(cowBodyHitsForbidden(start.x, start.y, [tractor]), false);
});

test("a path through the tractor is rejected", () => {
  const tractor = uvRectToLocal(PLAYFIELD_LAYOUT.blockers.tractor, 1536, 1024);
  const midX = (tractor.x0 + tractor.x1) / 2;
  const midY = (tractor.y0 + tractor.y1) / 2;
  assert.equal(pathHitsForbidden(tractor.x0 - 20, midY, tractor.x1 + 20, midY, [tractor]), true);
  assert.equal(pathHitsForbidden(midX, tractor.y0 - 20, midX, tractor.y1 + 20, [tractor]), true);
  assert.equal(pathHitsForbidden(0, 0, 10, 10, [tractor]), false);
});

test("sign overlays use the live child name from farm/admin data", () => {
  assert.equal(gardenSignName("Willow"), "Willow");
  assert.equal(gardenSignName("  Finn  "), "Finn");
  assert.equal(gardenSignName(""), "Garden");
});

test("garden plaques show seeds and points under the name", () => {
  assert.equal(gardenSignStats(10, 0), "10 seeds · 0 pts");
  assert.equal(gardenSignStats(3, 12), "3 seeds · 12 pts");
});

test("nine playable mounds sit on measured mound peaks, not a soil-rect lerp", () => {
  const garden = PLAYFIELD_LAYOUT.gardens[0];
  const slots = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((slot) => moundUv(garden, slot));
  assert.equal(garden.mounds.length, 9);
  assert.ok(slots[0].u < slots[1].u && slots[1].u < slots[2].u);
  assert.ok(slots[0].v < slots[3].v && slots[3].v < slots[6].v, "row 0 back, row 2 front");
  for (const uv of slots) {
    assert.ok(uv.u > garden.soil.u0 && uv.u < garden.soil.u1);
    assert.ok(uv.v > garden.soil.v0 && uv.v < garden.soil.v1);
  }
  // Legacy lerp used a tight 0.20×0.24 soil box; measured peaks are a wider 3×3.
  assert.ok(slots[2].u - slots[0].u > 0.12);
  assert.ok(slots[6].v - slots[0].v > 0.11);
  assert.ok(slots[0].u > 0.09 && slots[0].u < 0.13);
  assert.ok(slots[8].u > 0.23 && slots[8].u < 0.27);
  assert.ok(slots[0].v > 0.64 && slots[0].v < 0.67, "back row is the rear mound peaks, not the soil above them");
  assert.ok(slots[6].v > 0.76 && slots[6].v < 0.79, "front row stays on dirt, above the picket gate");
});

test("each farm garden has its own 9 mound anchors", () => {
  for (const garden of PLAYFIELD_LAYOUT.gardens) {
    assert.equal(garden.mounds.length, 9);
    const mid = moundUv(garden, 4);
    assert.ok(mid.u > garden.soil.u0 && mid.u < garden.soil.u1);
    assert.ok(mid.v > garden.soil.v0 && mid.v < garden.soil.v1);
  }
  const left = moundUv(PLAYFIELD_LAYOUT.gardens[0], 4);
  const center = moundUv(PLAYFIELD_LAYOUT.gardens[1], 4);
  const right = moundUv(PLAYFIELD_LAYOUT.gardens[2], 4);
  assert.ok(left.u < center.u && center.u < right.u);
});

test("right-facing cow sheet flips via scale.x when roaming left", () => {
  assert.equal(facingFromDx(12, 1), 1);
  assert.equal(facingFromDx(-8, 1), -1);
  assert.equal(facingFromDx(0, -1), -1, "hold last facing on a vertical step");
});
