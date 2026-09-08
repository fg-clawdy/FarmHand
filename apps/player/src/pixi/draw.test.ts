import assert from "node:assert/strict";
import test from "node:test";
import { cameraFit, containFit, coverFit } from "./draw.ts";

test("cover-fit fills the screen; contain-fit shows the whole painting", () => {
  const cover = coverFit(1600, 900, 1536, 1024);
  const contain = containFit(1600, 900, 1536, 1024);
  assert.ok(cover.scale > contain.scale);
  assert.ok(contain.scale * 1536 <= 1600 + 0.01);
  assert.ok(contain.scale * 1024 <= 900 + 0.01);
});

test("camera 0.85 never crops the garden painting", () => {
  const square = cameraFit(1536, 1024, 1536, 1024, 0.85);
  assert.ok(Math.abs(square.scale - 0.85) < 1e-9);
  const wide = cameraFit(1920, 1080, 1536, 1024, 0.85);
  const contain = containFit(1920, 1080, 1536, 1024);
  assert.ok(wide.scale <= contain.scale + 1e-9);
  assert.ok(wide.scale * 1536 <= 1920 + 0.5);
  assert.ok(wide.scale * 1024 <= 1080 + 0.5);
});
