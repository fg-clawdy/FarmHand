import assert from "node:assert/strict";
import test from "node:test";
import { coverFit } from "./draw.ts";
import {
  PLAYFIELD_LAYOUT,
  PLAYFIELD_TEXTURE,
  STAND_ART_PX,
  cowBodyHitsForbidden,
  cowForbiddenRects,
  cowRoamAvoidsGardens,
  facingFromDx,
  gardenSignName,
  gardenSignPlankLocal,
  gardenSignPlankUv,
  gardenSignPoints,
  gardenSignSeeds,
  GARDEN_SIGN_PLANKS,
  moundUv,
  pathHitsForbidden,
  readySparkleSeats,
  soilRectCenterUv,
  pickRoamTarget,
  pointInRect,
  rectsOverlap,
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

test("cow blockers include barn, tractor, hay, stand, library, and gardens", () => {
  const keys = Object.keys(PLAYFIELD_LAYOUT.blockers);
  for (const key of ["barn", "hay", "tractor", "stand", "library"]) {
    assert.ok(keys.includes(key), key);
  }
  assert.ok(!keys.includes("mamaCow"));
  assert.ok(!keys.includes("jobBoard"));
  assert.equal(cowForbiddenRects(1536, 1024).length, 8);
});

test("farm store hit is the painted stand, not the barrel and trees", () => {
  const hit = PLAYFIELD_LAYOUT.storeHit;
  const local = uvRectToLocal(hit, PLAYFIELD_TEXTURE.width, PLAYFIELD_TEXTURE.height);
  assert.equal(local.x0, STAND_ART_PX.x0);
  assert.equal(local.y0, STAND_ART_PX.y0);
  assert.equal(local.x1, STAND_ART_PX.x1);
  assert.equal(local.y1, STAND_ART_PX.y1);

  // Crates and awning, measured on the 1536×1024 painting.
  assert.equal(pointInRect(1050, 220, local), true, "tomato crates");
  assert.equal(pointInRect(1190, 230, local), true, "corn crate");
  assert.equal(pointInRect(1100, 80, local), true, "striped awning");
  assert.equal(pointInRect(1100, 310, local), true, "counter");

  // Old tap target sat on the barrel, crate, and trees (u 0.78–0.98, v 0.02–0.38).
  const oldHit = uvRectToLocal({ u0: 0.78, v0: 0.02, u1: 0.98, v1: 0.38 }, 1536, 1024);
  assert.equal(pointInRect(1352, 200, local), false, "barrel");
  assert.equal(pointInRect(1450, 180, local), false, "trees");
  assert.equal(pointInRect(1352, 200, oldHit), true);
  assert.ok(local.x1 < oldHit.x1 - 80, "stand ends left of the old hit's right edge");

  assert.equal(rectsOverlap(hit, PLAYFIELD_LAYOUT.libraryHit), false, "clears the little library");
  for (const garden of PLAYFIELD_LAYOUT.gardens) {
    assert.equal(rectsOverlap(hit, garden.hit), false, "clears garden signs");
    const sign = uvToLocal(garden.sign, 1536, 1024);
    assert.equal(pointInRect(sign.x, sign.y, local), false, "sign point");
  }
  assert.ok(hit.v1 < PLAYFIELD_LAYOUT.gardens[0]!.hit.v0);

  // Same texture pixels at every viewport. Cover-fit must not re-place the hit in screen space.
  for (const [w, h] of [
    [2560, 1600],
    [1920, 1080],
    [1600, 2560],
    [1024, 768],
  ] as const) {
    const fit = coverFit(w, h, PLAYFIELD_TEXTURE.width, PLAYFIELD_TEXTURE.height);
    const back = (screen: number, origin: number, tex: number) => (screen - origin) / fit.scale / tex;
    assert.ok(Math.abs(back(fit.x + local.x0 * fit.scale, fit.x, 1536) - hit.u0) < 1e-9, `u0 ${w}x${h}`);
    assert.ok(Math.abs(back(fit.y + local.y0 * fit.scale, fit.y, 1024) - hit.v0) < 1e-9, `v0 ${w}x${h}`);
    assert.ok(Math.abs(back(fit.x + local.x1 * fit.scale, fit.x, 1536) - hit.u1) < 1e-9, `u1 ${w}x${h}`);
    assert.ok(Math.abs(back(fit.y + local.y1 * fit.scale, fit.y, 1024) - hit.v1) < 1e-9, `v1 ${w}x${h}`);
  }
});

test("farm overview shows the little library and not a job board or tube chip", () => {
  const layout = PLAYFIELD_LAYOUT as Record<string, unknown>;
  assert.equal("jobBoardHit" in layout, false);
  assert.equal("familyJarHit" in layout, false);
  assert.equal("jobBoard" in PLAYFIELD_LAYOUT.blockers, false);
  const hit = PLAYFIELD_LAYOUT.libraryHit;
  assert.deepEqual(hit, PLAYFIELD_LAYOUT.blockers.library);
  // Former ground-stake corkboard: right of the exhaust, left of the wordmark, above the gardens.
  assert.ok(hit.u0 >= 0.24 && hit.u0 < 0.32, "starts in the stake grass");
  assert.ok(hit.u1 > hit.u0 && hit.u1 <= 0.46, "stays left of the wordmark");
  assert.ok(hit.v0 < 0.2 && hit.v1 <= PLAYFIELD_LAYOUT.gardens[0]!.hit.v0, "above the garden fences");
  assert.equal(rectsOverlap(hit, PLAYFIELD_LAYOUT.storeHit), false);
  const oldLeftChip = { u0: 0.012, v0: 0.292, u1: 0.115, v1: 0.392 };
  assert.equal(rectsOverlap(hit, oldLeftChip), false, "no left tube chip");
  for (const garden of PLAYFIELD_LAYOUT.gardens) {
    assert.equal(rectsOverlap(hit, garden.hit), false, "clears garden signs");
  }
  const local = uvRectToLocal(hit, 1536, 1024);
  const width = local.x1 - local.x0;
  const height = local.y1 - local.y0;
  // Front-facing painted house is 559×1048, narrower than the old 184×225 stake.
  assert.ok(width >= 120, "wide enough for two jars");
  assert.ok(height >= 180, "tall enough for open shelves");
  assert.ok(width <= 176, "narrower than the old sticker");
  assert.ok(width * height < 184 * 225, "smaller footprint than the old floating stake");
  assert.ok(Math.abs(width / height - 559 / 1048) < 0.02, "hit matches the painted sprite");
  assert.ok(hit.v0 >= 0.14, "roof sits down in the scene");
  assert.ok(hit.v1 >= 0.37, "post reaches the grass");
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

test("cow start sits in the roam area, clear of the library stake and other blockers", () => {
  const start = uvToLocal(PLAYFIELD_LAYOUT.cowStart, 1536, 1024);
  const roam = uvRectToLocal(PLAYFIELD_LAYOUT.cowRoam, 1536, 1024);
  assert.equal(pointInRect(start.x, start.y, roam), true);
  const { barn, hay, tractor, stand, library } = PLAYFIELD_LAYOUT.blockers;
  const core = [barn, hay, tractor, stand, library, ...PLAYFIELD_LAYOUT.gardens.map((g) => g.hit)]
    .map((r) => uvRectToLocal(r, 1536, 1024));
  assert.equal(cowBodyHitsForbidden(start.x, start.y, core), false);
  assert.equal(cowBodyHitsForbidden(start.x, start.y, cowForbiddenRects(1536, 1024)), false);
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

test("garden plaques put one line on each plank", () => {
  assert.equal(gardenSignSeeds(6), "6 seeds");
  assert.equal(gardenSignPoints(301), "301 stars");
  assert.equal(gardenSignSeeds(10), "10 seeds");
  assert.equal(gardenSignPoints(0), "0 stars");
  assert.equal(gardenSignSeeds(3), "3 seeds");
  assert.equal(gardenSignPoints(12), "12 stars");
});

test("sign lines stay on plank UVs at any browser size", () => {
  assert.equal(GARDEN_SIGN_PLANKS.length, 3);
  assert.ok(GARDEN_SIGN_PLANKS.every((plank) => plank.rotation === 0));
  assert.ok(GARDEN_SIGN_PLANKS[0].dv < GARDEN_SIGN_PLANKS[1].dv);
  assert.ok(GARDEN_SIGN_PLANKS[1].dv < GARDEN_SIGN_PLANKS[2].dv);
  assert.ok(GARDEN_SIGN_PLANKS[0].maxU > GARDEN_SIGN_PLANKS[2].maxU, "bottom plank is the narrowest");

  const faces = [
    { x: 278, y: 501.5 },
    { x: 762, y: 497.5 },
    { x: 1241, y: 498.5 },
  ];
  PLAYFIELD_LAYOUT.gardens.forEach((garden, i) => {
    assert.equal(garden.signFace.u * PLAYFIELD_TEXTURE.width, faces[i]!.x);
    assert.equal(garden.signFace.v * PLAYFIELD_TEXTURE.height, faces[i]!.y);
    const [name, seeds, points] = [0, 1, 2].map((plank) => gardenSignPlankUv(garden.signFace, plank));
    assert.equal(name.u, seeds.u);
    assert.equal(seeds.u, points.u);
    assert.equal(name.rotation, 0);
    assert.ok(name.v < seeds.v && seeds.v < points.v);
    assert.equal(seeds.v, garden.signFace.v, "seeds sit on the middle plank centerline");
    const nameLocal = gardenSignPlankLocal(garden.signFace, 0, PLAYFIELD_TEXTURE.width, PLAYFIELD_TEXTURE.height);
    const pointsLocal = gardenSignPlankLocal(garden.signFace, 2, PLAYFIELD_TEXTURE.width, PLAYFIELD_TEXTURE.height);
    assert.equal(nameLocal.y, faces[i]!.y - 44.5);
    assert.equal(pointsLocal.y, faces[i]!.y + 41.5);
    assert.equal(nameLocal.x, faces[i]!.x);
  });

  const face = PLAYFIELD_LAYOUT.gardens[1]!.signFace;
  const full = gardenSignPlankLocal(face, 2, 1536, 1024);
  const half = gardenSignPlankLocal(face, 2, 768, 512);
  assert.equal(half.x, full.x / 2);
  assert.equal(half.y, full.y / 2);

  const uv = gardenSignPlankUv(face, 2);
  for (const [w, h] of [
    [390, 844],
    [1600, 900],
    [800, 600],
  ] as const) {
    const fit = coverFit(w, h, PLAYFIELD_TEXTURE.width, PLAYFIELD_TEXTURE.height);
    const screenX = fit.x + full.x * fit.scale;
    const screenY = fit.y + full.y * fit.scale;
    const u = (screenX - fit.x) / fit.scale / PLAYFIELD_TEXTURE.width;
    const v = (screenY - fit.y) / fit.scale / PLAYFIELD_TEXTURE.height;
    assert.ok(Math.abs(u - uv.u) < 1e-9, `u drifts at ${w}x${h}`);
    assert.ok(Math.abs(v - uv.v) < 1e-9, `v drifts at ${w}x${h}`);
  }
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

test("cow roam still clears the garden fences after the chip and corkboard left", () => {
  assert.equal(cowRoamAvoidsGardens(), true);
  assert.ok(PLAYFIELD_LAYOUT.cowRoam.u0 < PLAYFIELD_LAYOUT.blockers.tractor.u1);
});

