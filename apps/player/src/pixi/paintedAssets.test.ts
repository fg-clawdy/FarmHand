import assert from "node:assert/strict";
import test from "node:test";
import { sheetFrameRects, SHEET_INSET } from "./paintedAssets.ts";

test("cow sheet frames are equal, in-bounds, and do not share pixels", () => {
  const sheetW = 1736;
  const sheetH = 247;
  const frames = 7;
  const rects = sheetFrameRects(sheetW, sheetH, frames);
  assert.equal(rects.length, frames);
  const cell = Math.floor(sheetW / frames);
  for (let i = 0; i < frames; i++) {
    const r = rects[i]!;
    assert.equal(r.w, cell - SHEET_INSET * 2);
    assert.equal(r.h, sheetH - SHEET_INSET * 2);
    assert.equal(r.x, i * cell + SHEET_INSET);
    assert.ok(r.x >= 0 && r.x + r.w <= sheetW);
    assert.ok(r.y >= 0 && r.y + r.h <= sheetH);
    if (i > 0) {
      const prev = rects[i - 1]!;
      assert.ok(prev.x + prev.w <= r.x, "adjacent frames must not share an x pixel");
    }
  }
});
