import assert from "node:assert/strict";
import test from "node:test";
import {
  CROP_DISC_IN_CELL,
  CROP_FRAME_WIDTH,
  CROP_SHEET,
  CROP_SHEET_HEIGHT,
  COW_EAT_SHEET,
  FARM_MOUND_COVER_PX,
  PAINTED_ART,
  SHEET_INSET,
  ZOOM_MOUND_COVER_PX,
  cropCoverScale,
  cropDiscAnchor,
  sheetFrameRects,
} from "./paintedAssets.ts";

test("walk uses two separate textures, not a combined walk/eat sheet", () => {
  assert.equal(PAINTED_ART.cowWalk.length, 2);
  assert.equal(PAINTED_ART.cowWalk[0], "/art/painted/cow_walk_frame_a.png");
  assert.equal(PAINTED_ART.cowWalk[1], "/art/painted/cow_walk_frame_b.png");
  assert.equal(PAINTED_ART.cowEat, "/art/painted/cow_eat_sheet.png");
  assert.ok(!JSON.stringify(PAINTED_ART).includes("cow_walk_eat_sheet"));
  assert.ok(PAINTED_ART.cowEat.endsWith(".png"));
  assert.ok(PAINTED_ART.cowWalk.every((url) => url.endsWith(".png")));
  assert.ok(PAINTED_ART.playfield.includes("v3_no_static_cow"));
  assert.equal(PAINTED_ART.gardenZoom, "/art/painted/garden/garden_zoom_3x3.jpg");
});

test("approved crop sheets are 1568-wide soil+plant cells, not 1440 plant-only", () => {
  assert.equal(CROP_SHEET.width, 1568);
  assert.equal(CROP_SHEET.frames, 4);
  assert.equal(CROP_FRAME_WIDTH, 392);
  assert.equal(CROP_SHEET_HEIGHT.corn, 854);
  assert.equal(CROP_SHEET_HEIGHT.strawberry, 464);
  assert.equal(CROP_SHEET_HEIGHT.cotton, 623);
  assert.ok(PAINTED_ART.crops.corn.endsWith(".png"));
  assert.ok(PAINTED_ART.crops.strawberry.endsWith(".png"));
  assert.ok(PAINTED_ART.crops.cotton.endsWith(".png"));
});

test("crop disc pivot sits inside the soil mound, not the cell midpoint leftover", () => {
  for (const kind of ["corn", "strawberry", "cotton"] as const) {
    for (const stage of [1, 2, 3, 4] as const) {
      const a = cropDiscAnchor(kind, stage);
      assert.ok(a.x > 0.3 && a.x < 0.7, `${kind} ${stage} x=${a.x}`);
      assert.ok(a.y > 0.55 && a.y < 0.98, `${kind} ${stage} y=${a.y}`);
    }
  }
});

test("cover scale makes the soil disc match the painted mound diameter", () => {
  const zoom = cropCoverScale("corn", 1, ZOOM_MOUND_COVER_PX);
  const farm = cropCoverScale("corn", 1, FARM_MOUND_COVER_PX);
  const d = CROP_DISC_IN_CELL.corn[0]!.d;
  assert.ok(Math.abs(zoom * d - ZOOM_MOUND_COVER_PX) < 0.01);
  assert.ok(Math.abs(farm * d - FARM_MOUND_COVER_PX) < 0.01);
  assert.ok(ZOOM_MOUND_COVER_PX >= 200);
  assert.ok(FARM_MOUND_COVER_PX >= 40);
});

test("crop sheet slices are equal, in-bounds, and do not share pixels", () => {
  const rects = sheetFrameRects(CROP_SHEET.width, CROP_SHEET_HEIGHT.corn, CROP_SHEET.frames);
  assert.equal(rects.length, 4);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]!;
    assert.equal(r.x, i * CROP_FRAME_WIDTH + SHEET_INSET);
    assert.equal(r.w, CROP_FRAME_WIDTH - SHEET_INSET * 2);
    assert.equal(r.h, CROP_SHEET_HEIGHT.corn - SHEET_INSET * 2);
    if (i > 0) {
      const prev = rects[i - 1]!;
      assert.ok(prev.x + prev.w <= r.x, "adjacent crop frames must not share an x pixel");
    }
  }
});

test("eat sheet frames are equal, in-bounds, and do not share pixels", () => {
  const { width: sheetW, height: sheetH, frames } = COW_EAT_SHEET;
  const rects = sheetFrameRects(sheetW, sheetH, frames);
  assert.equal(rects.length, frames);
  const cell = Math.floor(sheetW / frames);
  for (let i = 0; i < rects.length; i++) {
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
