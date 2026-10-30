import assert from "node:assert/strict";
import test from "node:test";
import { planDonation } from "./balloonMath.ts";
import {
  awayPose,
  beginDonation,
  bodyDrawScale,
  bowOpacity,
  buildTimeline,
  bunchPose,
  easeInOutCubic,
  ghostOpacity,
  idleBob,
  lerpPose,
  lockBounce,
  lockProgress,
  lockSquash,
  motionDurations,
  restPose,
  sampleDonation,
  stepAnim,
  zoomPose,
} from "./balloonMotion.ts";

const STAGE_W = 2560;
const STAGE_H = 1600;

test("zoom-in settles with a small overshoot and the return is a full glide", () => {
  const durations = motionDurations(false);
  assert.ok(durations.zoomIn >= 0.8 && durations.zoomIn <= 1);
  assert.ok(durations.zoomOut >= 0.9 && durations.zoomOut <= 1.1);
  assert.ok(durations.hold >= 0.6 && durations.hold <= 0.75);
  assert.ok(durations.lock >= 0.38 && durations.lock <= 0.48);
  assert.equal(durations.cardDelay, 1.2);
  assert.equal(durations.cardFade, 0.4);
});

test("zoom ease is planted at both ends", () => {
  assert.equal(easeInOutCubic(0), 0);
  assert.equal(easeInOutCubic(1), 1);
  assert.equal(easeInOutCubic(0.5), 0.5);
  const start = easeInOutCubic(0.001) / 0.001;
  const end = (1 - easeInOutCubic(0.999)) / 0.001;
  assert.ok(start < 0.02, `start speed ${start}`);
  assert.ok(end < 0.02, `end speed ${end}`);
});

test("rest, zoom, and float-away poses meet exactly", () => {
  const rest = restPose(STAGE_W, STAGE_H, 6);
  const zoom = zoomPose(STAGE_W, STAGE_H, 6);
  assert.deepEqual(lerpPose(rest, zoom, 0), rest);
  assert.deepEqual(lerpPose(rest, zoom, 1), zoom);
  assert.deepEqual(awayPose(zoom, 0, STAGE_H), zoom);
  assert.equal(awayPose(zoom, 1, STAGE_H).opacity, 0);
  assert.ok(awayPose(zoom, 1, STAGE_H).y < 0);
});

test("zoom travel is monotonic and gentlest at the ends", () => {
  const rest = restPose(STAGE_W, STAGE_H, 6);
  const zoom = zoomPose(STAGE_W, STAGE_H, 6);
  const samples = Array.from({ length: 61 }, (_, i) => lerpPose(rest, zoom, i / 60));
  const speeds: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    speeds.push(Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y));
    const toward = Math.hypot(zoom.x - samples[i].x, zoom.y - samples[i].y);
    const towardPrev = Math.hypot(zoom.x - samples[i - 1].x, zoom.y - samples[i - 1].y);
    assert.ok(toward <= towardPrev + 1e-6);
  }
  const mid = speeds[30];
  assert.ok(speeds[0] < mid * 0.2, `start step ${speeds[0]} mid ${mid}`);
  assert.ok(speeds[speeds.length - 1] < mid * 0.2, `end step ${speeds[speeds.length - 1]} mid ${mid}`);
});

test("reduced motion is a short version of the same gesture", () => {
  const plan = planDonation(1100, 0, 100);
  const full = buildTimeline(plan, false);
  const reduced = buildTimeline(plan, true);
  assert.ok(reduced.duration < full.duration / 2);
  assert.equal(motionDurations(true).sparkle, false);
  assert.equal(motionDurations(true).confetti, false);
  assert.equal(motionDurations(true).bounce, false);
  assert.equal(motionDurations(true).bob, false);
  assert.equal(idleBob(1.2, 0, true), 0);
  assert.notEqual(idleBob(0.4, 0, false), 0);
  assert.equal(idleBob(0.4, 1, false), 0);
});

test("inflation eases, holds while a balloon locks, and lands on the real total", () => {
  const plan = planDonation(1100, 100, 250);
  const timeline = buildTimeline(plan, false);
  assert.equal(sampleDonation(plan.from, timeline.windows, 0), 100);
  assert.equal(sampleDonation(plan.from, timeline.windows, timeline.duration), 350);
  const first = timeline.windows[0];
  assert.equal(first.completes, true);
  assert.equal(sampleDonation(plan.from, timeline.windows, first.end + timeline.lock / 2), 200);
  const locking = lockProgress(timeline, first.end + timeline.lock / 2);
  assert.equal(locking?.index, 0);
  assert.ok(locking && locking.t > 0.45 && locking.t < 0.55);
  let prev = 100;
  for (let i = 1; i <= 48; i++) {
    const value = sampleDonation(plan.from, timeline.windows, (timeline.duration * i) / 48);
    assert.ok(value >= prev - 1e-6, `${prev} -> ${value}`);
    prev = value;
  }
  assert.equal(prev, 350);
});

test("a full balloon locks with a bounce that starts and ends at the honest size", () => {
  assert.equal(ghostOpacity(false, null, 0), 1);
  assert.equal(ghostOpacity(true, { index: 0, t: 0 }, 0), 1);
  assert.equal(ghostOpacity(true, { index: 0, t: 1 }, 0), 0);
  assert.equal(ghostOpacity(true, null, 0), 0);
  assert.equal(bowOpacity(false, null, 0), 0);
  assert.equal(bowOpacity(true, { index: 0, t: 0 }, 0), 0);
  assert.equal(bowOpacity(true, null, 0), 1);
  assert.equal(lockBounce(0), 0);
  assert.equal(lockBounce(1), 0);
  assert.ok(lockBounce(0.2) > 0.05, "squash is visible");
  const early = lockSquash(0.2);
  const late = lockSquash(0.7);
  assert.ok(early.sx > 1 && early.sy < 1, "first half squashes wider");
  assert.ok(late.sx < 1 && late.sy > 1, "second half stretches taller");
  assert.deepEqual(lockSquash(0), { sx: 1, sy: 1 });
  assert.deepEqual(lockSquash(1), { sx: 1, sy: 1 });
  assert.equal(bodyDrawScale(0.5, { index: 0, t: 0.5 }, 0, true), 0.5);
});

test("giving 100 to an empty 1100 goal zooms, inflates to 100, and returns to the same rest pose", () => {
  const plan = planDonation(1100, 0, 100);
  let state = beginDonation(0, plan, false, 0);
  const before = bunchPose(STAGE_W, STAGE_H, 6, state, 0, true);
  assert.equal(state.phase, "zoom-in");
  assert.equal(state.zoomU, 0);
  assert.deepEqual(before, restPose(STAGE_W, STAGE_H, 6));

  const zoomInMs = motionDurations(false).zoomIn * 1000;
  state = stepAnim(state, zoomInMs, false);
  assert.equal(state.phase, "inflate");
  assert.equal(state.zoomU, 1);
  assert.equal(state.shown, 0);
  assert.deepEqual(bunchPose(STAGE_W, STAGE_H, 6, state, 0, true), zoomPose(STAGE_W, STAGE_H, 6));

  state = stepAnim(state, state.t0 + state.timeline!.duration * 1000, false);
  assert.equal(state.phase, "hold");
  assert.equal(state.shown, 100);

  state = stepAnim(state, state.t0 + motionDurations(false).hold * 1000, false);
  assert.equal(state.phase, "zoom-out");
  assert.equal(state.shown, 100);

  state = stepAnim(state, state.t0 + motionDurations(false).zoomOut * 1000, false);
  assert.equal(state.phase, "rest");
  assert.equal(state.zoomU, 0);
  assert.equal(state.shown, 100);
  assert.deepEqual(bunchPose(STAGE_W, STAGE_H, 6, state, 0, true), before);
});

test("filling the goal floats the bunch away instead of shrinking back", () => {
  const plan = planDonation(200, 100, 100);
  assert.equal(plan.reached, true);
  let state = beginDonation(100, plan, false, 0);
  const zoomInMs = motionDurations(false).zoomIn * 1000;
  state = stepAnim(state, zoomInMs, false);
  state = stepAnim(state, state.t0 + state.timeline!.duration * 1000, false);
  assert.equal(state.shown, 200);
  state = stepAnim(state, state.t0 + motionDurations(false).hold * 1000, false);
  assert.equal(state.phase, "away");
  const atLift = bunchPose(STAGE_W, STAGE_H, 1, state, 0, true);
  assert.deepEqual(atLift, zoomPose(STAGE_W, STAGE_H, 1));
  state = stepAnim(state, state.t0 + motionDurations(false).away * 1000, false);
  assert.equal(state.phase, "reward");
  assert.equal(bunchPose(STAGE_W, STAGE_H, 1, state, 0, true).opacity, 0);
});
