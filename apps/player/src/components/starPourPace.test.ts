import assert from "node:assert/strict";
import test from "node:test";
import { starLaunchDelay, starPourDuration } from "./starPourPace";

test("10 stars stay slow, and 250 stars take longer but not 25 times longer", () => {
  const ten = starLaunchDelay(9, 10);
  const twoFifty = starLaunchDelay(249, 250);
  assert.ok(ten >= 9 * 0.18, `10 stars should stay slow, got ${ten}`);
  assert.ok(twoFifty > ten);
  assert.ok(twoFifty < ten * 8, `middle should speed up, 250 launch was ${twoFifty}`);
  assert.ok(starPourDuration(10) < starPourDuration(250));
});

test("a long pour starts slow, runs fast, then slows for the last stars", () => {
  const earlyGap = starLaunchDelay(2, 250) - starLaunchDelay(1, 250);
  const midGap = starLaunchDelay(120, 250) - starLaunchDelay(119, 250);
  const lateGap = starLaunchDelay(248, 250) - starLaunchDelay(247, 250);
  assert.ok(earlyGap > midGap * 2, `start ${earlyGap} middle ${midGap}`);
  assert.ok(lateGap > midGap * 2, `end ${lateGap} middle ${midGap}`);
});
