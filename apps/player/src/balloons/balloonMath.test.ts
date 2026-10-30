import assert from "node:assert/strict";
import test from "node:test";
import {
  BALLOON_PRESETS,
  BALLOON_STAGE,
  STARS_PER_BALLOON,
  balloonCount,
  balloonsFor,
  bunchPoints,
  formatStarCount,
  nubOpacity,
  planDonation,
  restingFootprint,
  restingScreenWidth,
  rowPattern,
  slotCapacity,
  zoomScreenWidth,
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

test("100 stars in a 200 goal is exactly half of a full-size ghost", () => {
  const [slot] = balloonsFor(200, 100);
  assert.equal(slot.capacity, 200);
  assert.equal(slot.stars, 100);
  assert.equal(slot.fill, 0.5);
  assert.equal(slot.bodyScale, 0.5);
  assert.equal(slot.targetScale, 1);
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
  assert.equal(partial[5].bodyScale, 0.25);
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
  assert.equal(slots[1].bodyScale, 0.25);
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

test("many balloons cluster instead of taking over the farm", () => {
  assert.ok(restingFootprint(15) < restingFootprint(6));
  assert.ok(restingFootprint(6) < restingFootprint(1));
  assert.equal(rowPattern(6).length, 1);
  assert.equal(rowPattern(15).reduce((sum, row) => sum + row, 0), 15);
  assert.equal(bunchPoints(15).length, 15);
  const wide = BALLOON_STAGE.width;
  const tall = BALLOON_STAGE.height;
  const cluster = restingScreenWidth(wide, 15);
  assert.ok(cluster < wide * 0.28, `15-balloon bunch is ${cluster}px wide`);
  assert.ok(zoomScreenWidth(wide, tall, 1) > restingScreenWidth(wide, 1) * 1.5);
  assert.ok(zoomScreenWidth(wide, tall, 6) > restingScreenWidth(wide, 6) * 1.5);
  assert.ok(zoomScreenWidth(wide, tall, 15) > restingScreenWidth(wide, 15) * 1.5);
  assert.ok(zoomScreenWidth(wide, tall, 15) < wide * 0.42);
});

test("star labels group thousands and stay secondary-friendly", () => {
  assert.equal(formatStarCount(100), "100");
  assert.equal(formatStarCount(1100), "1,100");
  assert.equal(formatStarCount(3000), "3,000");
});
