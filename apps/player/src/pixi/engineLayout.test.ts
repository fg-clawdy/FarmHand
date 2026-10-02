import assert from "node:assert/strict";
import test from "node:test";
import { coverFit } from "./draw.ts";
import { hostHasSize, STALL_MS, tickerStalled } from "./engine.ts";

test("hostHasSize rejects the pre-layout 0x0 / 1x1 trap", () => {
  assert.equal(hostHasSize({ clientWidth: 0, clientHeight: 0 } as HTMLElement), false);
  assert.equal(hostHasSize({ clientWidth: 1, clientHeight: 1 } as HTMLElement), false);
  assert.equal(hostHasSize({ clientWidth: 2, clientHeight: 2 } as HTMLElement), true);
  assert.equal(hostHasSize({ clientWidth: 800, clientHeight: 600 } as HTMLElement), true);
});

test("coverFit at 1x1 collapses the playfield into a single green-looking pixel", () => {
  // Matches the shared-canvas bug: Math.max(1, clientWidth) while host is still 0x0.
  // CSS then stretches the 1x1 buffer; hit UVs still map, but the paint is solid green.
  const fit = coverFit(1, 1, 1536, 1024);
  assert.ok(fit.scale < 0.002);
  assert.ok(Math.abs(fit.scale - 1 / 1024) < 1e-12);
});

test("coverFit at a real tablet size keeps the playfield covering the view", () => {
  const fit = coverFit(800, 1280, 1536, 1024);
  assert.ok(fit.scale * 1536 >= 800 - 1);
  assert.ok(fit.scale * 1024 >= 1280 - 1);
});

test("tickerStalled flags a visible page whose ticker stopped drawing", () => {
  assert.equal(tickerStalled({ visible: true, now: 5000, lastFrameAt: 1000 }), true);
  assert.equal(tickerStalled({ visible: true, now: 1100, lastFrameAt: 1000 }), false);
  assert.equal(tickerStalled({ visible: true, now: 1000 + STALL_MS, lastFrameAt: 1000 }), false);
  assert.equal(tickerStalled({ visible: true, now: 1000 + STALL_MS + 1, lastFrameAt: 1000 }), true);
});

test("tickerStalled never fires while the page is hidden (ticker is stopped on purpose)", () => {
  assert.equal(tickerStalled({ visible: false, now: 99999, lastFrameAt: 0 }), false);
});

