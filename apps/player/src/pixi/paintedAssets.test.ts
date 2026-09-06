import assert from "node:assert/strict";
import test from "node:test";
import { COW_EAT_SHEET, PAINTED_ART, sheetFrameRects, SHEET_INSET } from "./paintedAssets.ts";

test("walk uses two separate textures, not a combined walk/eat sheet", () => {
  assert.equal(PAINTED_ART.cowWalk.length, 2);
  assert.equal(PAINTED_ART.cowWalk[0], "/art/painted/cow_walk_frame_a.png");
  assert.equal(PAINTED_ART.cowWalk[1], "/art/painted/cow_walk_frame_b.png");
  assert.equal(PAINTED_ART.cowEat, "/art/painted/cow_eat_sheet.png");
  assert.ok(!JSON.stringify(PAINTED_ART).includes("cow_walk_eat_sheet"));
  assert.ok(PAINTED_ART.cowEat.endsWith(".png"));
  assert.ok(PAINTED_ART.cowWalk.every((url) => url.endsWith(".png")));
  assert.ok(PAINTED_ART.playfield.includes("v3_no_static_cow"));
});

test("eat sheet frames are equal, in-bounds, and do not share pixels", () => {
  const { width: sheetW, height: sheetH, frames } = COW_EAT_SHEET;
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
