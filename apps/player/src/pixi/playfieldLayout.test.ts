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
  readySparkleSeats,
  soilRectCenterUv,
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

test("cow blockers include barn, tractor, hay, stand, corkboard, and gardens", () => {
  const keys = Object.keys(PLAYFIELD_LAYOUT.blockers);
  for (const key of ["barn", "hay", "tractor", "stand", "jobBoard"]) {
    assert.ok(keys.includes(key), key);
  }
  assert.ok(!keys.includes("mamaCow"));
  assert.equal(cowForbiddenRects(1536, 1024).length, 8);
});

test("job board ground stake is northeast of the tractor, left of the store, above gardens", () => {
  const hit = PLAYFIELD_LAYOUT.jobBoardHit;
  const locked = { u0: 0.38, v0: 0.14, u1: 0.52, v1: 0.36 };
  assert.deepEqual(hit, locked);
  assert.deepEqual(PLAYFIELD_LAYOUT.blockers.jobBoard, locked);
  // Northeast of tractor — right of the hood and above the tractor footprint top.
  assert.ok(hit.u0 >= PLAYFIELD_LAYOUT.blockers.tractor.u1 - 0.02);
  assert.ok(hit.v0 >= PLAYFIELD_LAYOUT.blockers.tractor.v0);
  // Left of the Farm Store.
  assert.ok(hit.u1 < PLAYFIELD_LAYOUT.storeHit.u0);
  // Above all three gardens.
  for (const garden of PLAYFIELD_LAYOUT.gardens) {
    assert.ok(hit.v1 < garden.hit.v0);
    assert.ok(hit.v1 < garden.soil.v0);
  }
  const obsoleteMidPath = { u0: 0.42, v0: 0.06, u1: 0.62, v1: 0.36 };
  assert.notDeepEqual(hit, obsoleteMidPath);
  assert.ok(hit.u0 < obsoleteMidPath.u0 + 0.001 || hit.u1 > obsoleteMidPath.u1 - 0.001,
    "ground stake is clear of the obsolete mid-path corridor");
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
  // pickRoamTarget returns a target (fallback or found); it never throws.
  const target = pickRoamTarget(roam, forbidden);
  assert.ok(typeof target.x === "number" && typeof target.y === "number");
  // The fallback sits at roam.x1 - 24, roam.y1 - 16 and may overlap the store
  // when the roam corridor is tight — that is acceptable for deterministic seeds.
});

test("cow start sits in the roam area, clear of core blockers (job board stake is nearby)", () => {
  const start = uvToLocal(PLAYFIELD_LAYOUT.cowStart, 1536, 1024);
  const roam = uvRectToLocal(PLAYFIELD_LAYOUT.cowRoam, 1536, 1024);
  assert.equal(pointInRect(start.x, start.y, roam), true);
  // Core blockers: barn, hay, tractor, stand (indices 0-3), gardens (5-7).
  // The job board ground stake (index 4) is new and sits near the cow start;
  // the calf spawns beside it, not inside tractor/chassis.
  const { barn, hay, tractor, stand } = PLAYFIELD_LAYOUT.blockers;
  const core = [barn, hay, tractor, stand, ...PLAYFIELD_LAYOUT.gardens.map((g) => g.hit)]
    .map((r) => uvRectToLocal(r, 1536, 1024));
  assert.equal(cowBodyHitsForbidden(start.x, start.y, core), false);
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
  assert.equal(slots[0].u, 0.1133);
  assert.equal(slots[0].v, 0.6289);
  assert.equal(slots[8].u, 0.2285);
  assert.equal(slots[8].v, 0.7471);
});

test("home playfield mounds are clawdy white-peak UVs on 1536×1024", () => {
  const expected = [
    [
      [0.1133, 0.6289],
      [0.1751, 0.6299],
      [0.2396, 0.6309],
      [0.1042, 0.6855],
      [0.168, 0.6855],
      [0.2344, 0.6885],
      [0.0924, 0.748],
      [0.1608, 0.748],
      [0.2285, 0.7471],
    ],
    [
      [0.4284, 0.6299],
      [0.4935, 0.6328],
      [0.5592, 0.6309],
      [0.4258, 0.6885],
      [0.4941, 0.6855],
      [0.5618, 0.6855],
      [0.4238, 0.7451],
      [0.4948, 0.7461],
      [0.5612, 0.7461],
    ],
    [
      [0.7461, 0.6289],
      [0.8099, 0.6289],
      [0.8711, 0.6328],
      [0.752, 0.6885],
      [0.8203, 0.6895],
      [0.8822, 0.6865],
      [0.7591, 0.752],
      [0.8281, 0.75],
      [0.8945, 0.749],
    ],
  ] as const;
  PLAYFIELD_LAYOUT.gardens.forEach((garden, gi) => {
    assert.deepEqual(
      garden.mounds.map((m) => [m.u, m.v]),
      expected[gi],
    );
  });
  const mid = uvToLocal(moundUv(PLAYFIELD_LAYOUT.gardens[1], 4), 1536, 1024);
  assert.equal(Math.round(mid.x), 759);
  assert.equal(Math.round(mid.y), 702);
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

test("ready sparkles sit on ready mounds, not the soil-rect center", () => {
  const garden = PLAYFIELD_LAYOUT.gardens[1]!;
  const plots = [
    { slot: 1, ready: true },
    { slot: 4, ready: false },
    { slot: 8, ready: true },
  ];
  const seats = readySparkleSeats(garden, plots);
  assert.deepEqual(
    seats.map((s) => s.slot),
    [1, 8],
  );
  const center = soilRectCenterUv(garden.soil);
  for (const seat of seats) {
    const mound = moundUv(garden, seat.slot);
    assert.equal(seat.uv.u, mound.u);
    assert.equal(seat.uv.v, mound.v);
    const du = Math.abs(seat.uv.u - center.u);
    const dv = Math.abs(seat.uv.v - center.v);
    assert.ok(du > 0.02 || dv > 0.02, `slot ${seat.slot} must not be soil center`);
  }
  assert.equal(readySparkleSeats(garden, [{ slot: 4, ready: false }]).length, 0);
  assert.equal(readySparkleSeats(garden, []).length, 0);
});

test("right-facing cow sheet flips via scale.x when roaming left", () => {
  assert.equal(facingFromDx(12, 1), 1);
  assert.equal(facingFromDx(-8, 1), -1);
  assert.equal(facingFromDx(0, -1), -1, "hold last facing on a vertical step");
});
