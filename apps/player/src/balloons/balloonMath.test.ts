import assert from "node:assert/strict";
import test from "node:test";
import {
  BALLOON_PRESETS,
  BALLOON_STAGE,
  BALLOON_TOP,
  STARS_PER_BALLOON,
  ZOOM_HEIGHT,
  balloonCount,
  balloonsFor,
  bunchPoints,
  formatStarCount,
  chromeExtent,
  nubOpacity,
  planDonation,
  restingBunchRect,
  restingFootprint,
  screenUv,
  slotCapacity,
  zoomScaleFor,
} from "./balloonMath.ts";

test("one full balloon is 200 stars, in a single constant", () => {
  assert.equal(STARS_PER_BALLOON, 200);
});

test("balloon counts follow ceil(cost / 200)", () => {
  assert.equal(balloonCount(0), 0);
  assert.equal(balloonCount(200), 1);
  assert.equal(balloonCount(1000), 5);
  assert.equal(balloonCount(1100), 6);
  assert.equal(balloonCount(3000), 15);
  assert.equal(balloonCount(201), 2);
});

test("the last balloon keeps only the remainder", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5].map((index) => slotCapacity(1100, index)),
    [200, 200, 200, 200, 200, 100],
  );
  assert.deepEqual(
    [0, 1, 2, 3, 4].map((index) => slotCapacity(1000, index)),
    [200, 200, 200, 200, 200],
  );
  assert.equal(slotCapacity(200, 0), 200);
  assert.equal(slotCapacity(3000, 14), 200);
});

test("100 stars in a 200 goal covers half the ghost by area", () => {
  const [slot] = balloonsFor(200, 100);
  assert.equal(slot.capacity, 200);
  assert.equal(slot.stars, 100);
  assert.equal(slot.fill, 0.5);
  assert.equal(slot.targetScale, 1);
  assert.ok(Math.abs(slot.bodyScale - Math.sqrt(0.5)) < 1e-12);
  assert.ok(Math.abs(slot.bodyScale * slot.bodyScale - 0.5) < 1e-12);
  assert.equal(slot.full, false);
  assert.equal(BALLOON_PRESETS.find((preset) => preset.id === "half")?.filled, 100);
});

test("empty balloons stay in the bunch and the 1100 remainder is a half-size ghost", () => {
  const empty = balloonsFor(1100, 0);
  assert.equal(empty.length, 6);
  assert.deepEqual(
    empty.map((slot) => slot.targetScale),
    [1, 1, 1, 1, 1, 0.5],
  );
  assert.ok(empty.every((slot) => slot.stars === 0 && slot.bodyScale === 0 && !slot.full));
  const partial = balloonsFor(1100, 1050);
  assert.equal(partial.filter((slot) => slot.full).length, 5);
  assert.equal(partial[5].capacity, 100);
  assert.equal(partial[5].stars, 50);
  assert.equal(partial[5].fill, 0.5);
  assert.equal(partial[5].targetScale, 0.5);
  assert.ok(Math.abs(partial[5].bodyScale - 0.5 * Math.sqrt(0.5)) < 1e-12);
  assert.equal(partial[5].full, false);
});

test("a finished 1100 goal locks the half-size balloon at half of a full balloon", () => {
  const done = balloonsFor(1100, 1100);
  assert.ok(done.every((slot) => slot.full));
  assert.equal(done[5].bodyScale, 0.5);
  assert.equal(done[5].targetScale, 0.5);
});

test("stars fill balloons in order", () => {
  const slots = balloonsFor(1100, 250);
  assert.deepEqual(
    slots.map((slot) => slot.stars),
    [200, 50, 0, 0, 0, 0],
  );
  assert.equal(slots[0].full, true);
  assert.ok(Math.abs(slots[1].bodyScale - Math.sqrt(0.25)) < 1e-12);
  assert.equal(slots[1].full, false);
});

test("a donation that crosses a balloon boundary finishes one balloon then the next", () => {
  const plan = planDonation(1100, 100, 250);
  assert.equal(plan.accepted, 250);
  assert.equal(plan.to, 350);
  assert.equal(plan.reached, false);
  assert.deepEqual(
    plan.segments.map((segment) => ({
      index: segment.index,
      fromStars: segment.fromStars,
      toStars: segment.toStars,
      completes: segment.completes,
    })),
    [
      { index: 0, fromStars: 100, toStars: 200, completes: true },
      { index: 1, fromStars: 0, toStars: 150, completes: false },
    ],
  );
});

test("finish clamps to the stars the goal still needs", () => {
  const plan = planDonation(200, 100, 999);
  assert.equal(plan.accepted, 100);
  assert.equal(plan.to, 200);
  assert.equal(plan.reached, true);
  assert.equal(plan.segments.length, 1);
  assert.equal(plan.segments[0].completes, true);
  assert.equal(planDonation(1100, 1100, 50).accepted, 0);
});

test("an empty balloon keeps a visible nub and a full one does not", () => {
  assert.equal(nubOpacity(0, 1), 1);
  assert.equal(nubOpacity(0, 0.5), 1);
  assert.ok(nubOpacity(0.025, 1) > 0.5);
  assert.equal(nubOpacity(1, 1), 0);
});

test("a six-balloon goal fans out so the front balloon and the half-size one stay visible", () => {
  const pts = bunchPoints(6);
  assert.equal(pts.length, 6);
  const front = pts.reduce((best, point) => (point.y > best.y ? point : best));
  assert.equal(front.index, 0);
  const half = pts.find((point) => point.index === 5);
  const lead = pts.find((point) => point.index === 0);
  assert.ok(half && lead);
  const gap = Math.hypot(half.x - lead.x, half.y - lead.y);
  assert.ok(gap > 90, `half balloon sits ${gap}px from the front balloon`);
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const apart = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      assert.ok(apart > 60, `balloons ${pts[i].index} and ${pts[j].index} are ${apart}px apart`);
    }
  }
});

test("many balloons cluster instead of taking over the farm", () => {
  assert.ok(restingFootprint(15) < restingFootprint(6));
  assert.ok(restingFootprint(6) < restingFootprint(1));
  const pts = bunchPoints(15);
  assert.equal(pts.length, 15);
  let close = 0;
  const xs = new Set<number>();
  for (let i = 0; i < pts.length; i++) {
    xs.add(Math.round(pts[i].x / 18));
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[i].x - pts[j].x;
      const dy = pts[i].y - pts[j].y;
      if (Math.hypot(dx, dy) < 150) close += 1;
    }
  }
  assert.ok(close >= 8, `overlapping pairs ${close}`);
  assert.ok(xs.size >= 6, `columns ${xs.size}`);
  const height = BALLOON_TOP * zoomScaleFor(BALLOON_STAGE.height, 1);
  assert.ok(Math.abs(height / BALLOON_STAGE.height - ZOOM_HEIGHT) < 0.001);
});

test("the resting bunch stays on open grass at tablet, desktop, and small landscape", () => {
  const views = [
    [2560, 1600],
    [1920, 1080],
    [1024, 768],
  ] as const;
  const signs = [
    { u0: 0.1, v0: 0.42, u1: 0.24, v1: 0.56 },
    { u0: 0.42, v0: 0.42, u1: 0.58, v1: 0.56 },
    { u0: 0.72, v0: 0.42, u1: 0.88, v1: 0.56 },
  ];
  const cow = { u0: 0.12, v0: 0.2, u1: 0.49, v1: 0.36 };
  const market = { u0: 0.62, v0: 0.0, u1: 0.99, v1: 0.4 };
  for (const [w, h] of views) {
    for (const count of [1, 6, 15]) {
      const box = restingBunchRect(w, h, count);
      assert.ok(box.top >= 8, `${w}x${h} n=${count} top ${box.top}`);
      assert.ok(box.left >= 8, `${w}x${h} n=${count} left ${box.left}`);
      assert.ok(box.right <= w - 8, `${w}x${h} n=${count} right ${box.right}`);
      assert.ok(box.bottom <= h - 8, `${w}x${h} n=${count} bottom ${box.bottom}`);
      for (const zone of [cow, market, ...signs]) {
        const a = screenUv(w, h, zone.u0, zone.v0);
        const b = screenUv(w, h, zone.u1, zone.v1);
        const other = {
          left: Math.min(a.x, b.x),
          top: Math.min(a.y, b.y),
          right: Math.max(a.x, b.x),
          bottom: Math.max(a.y, b.y),
        };
        const hit =
          box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top;
        assert.equal(hit, false, `${w}x${h} n=${count} overlaps a blocked zone`);
      }
    }
  }
  assert.ok(chromeExtent(1600) >= chromeExtent(768));
});

test("star labels group thousands and stay secondary-friendly", () => {
  assert.equal(formatStarCount(100), "100");
  assert.equal(formatStarCount(1100), "1,100");
  assert.equal(formatStarCount(3000), "3,000");
});
