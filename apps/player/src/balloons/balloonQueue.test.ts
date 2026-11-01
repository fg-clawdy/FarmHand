import assert from "node:assert/strict";
import test from "node:test";
import { planDonation } from "./balloonMath.ts";
import { displayFilled, enqueueDonation, meadowDuringPlayback, type BalloonJob } from "./balloonQueue.ts";

test("a 100 to 350 gift hands off before the second balloon grows", () => {
  const plan = planDonation(1100, 100, 250, 200);
  assert.equal(plan.per, 200);
  assert.equal(plan.to, 350);
  assert.equal(plan.segments[0]?.completes, true);
  assert.equal(plan.segments[1]?.fromStars, 0);
  assert.equal(plan.segments[1]?.toStars, 150);
});

test("two quick donations queue and stay on the server totals", () => {
  const first: BalloonJob = { goalId: "movie", title: "Movie night", cost: 1100, from: 0, to: 100 };
  const second: BalloonJob = { goalId: "movie", title: "Movie night", cost: 1100, from: 100, to: 350 };
  const queued = enqueueDonation(enqueueDonation([], first), second);
  assert.deepEqual(
    queued.map((job) => [job.from, job.to]),
    [
      [0, 100],
      [100, 350],
    ],
  );
  assert.equal(displayFilled("movie", 350, queued, queued[0]!), 0);
  assert.equal(displayFilled("movie", 350, queued.slice(1), null), 100);
  assert.equal(displayFilled("movie", 350, [], null), 350);
});

test("a goal that disappears mid-flight stays on the meadow until the animation rests", () => {
  const job: BalloonJob = { goalId: "movie", title: "Movie night", cost: 1100, from: 100, to: 350 };
  const previous = [
    { id: "movie", title: "Movie night", cost: 1100, filled: 100 },
    { id: "ice", title: "Ice cream", cost: 200, filled: 0 },
  ];
  const held = meadowDuringPlayback([{ id: "ice", title: "Ice cream", cost: 200, filled: 0 }], job, true, previous);
  assert.equal(held[0]?.id, "movie");
  assert.equal(held[1]?.id, "ice");
  const rested = meadowDuringPlayback([{ id: "ice", title: "Ice cream", cost: 200, filled: 0 }], job, false, previous);
  assert.deepEqual(rested.map((goal) => goal.id), ["ice"]);
});

test("a cost that is not a multiple of the tunable still has a short last balloon", () => {
  const plan = planDonation(250, 0, 250, 100);
  assert.equal(plan.per, 100);
  assert.equal(plan.segments.length, 3);
  assert.equal(plan.segments[2]?.capacity, 50);
  assert.equal(plan.reached, true);
});
