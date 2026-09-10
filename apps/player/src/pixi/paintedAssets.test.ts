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
  CORKBOARD_HANG,
  SHEET_INSET,
  WANTED_POSTER_SHEET,
  WANTED_POSTER_PAPER_INSET,
  ZOOM_MOUND_COVER_PX,
  cropCoverScale,
  cropDiscAnchor,
  sheetFrameRects,
  wantedPosterFrameRects,
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

test("approved crop sheets are 1920-wide unpacked soil+plant cells", () => {
  assert.equal(CROP_SHEET.width, 1920);
  assert.equal(CROP_SHEET.frames, 4);
  assert.equal(CROP_FRAME_WIDTH, 480);
  assert.equal(CROP_SHEET_HEIGHT.corn, 854);
  assert.equal(CROP_SHEET_HEIGHT.strawberry, 464);
  assert.equal(CROP_SHEET_HEIGHT.cotton, 623);
  assert.ok(PAINTED_ART.crops.corn.includes("plant_corn_stages.png"));
  assert.ok(PAINTED_ART.crops.strawberry.includes("plant_strawberry_stages.png"));
  assert.ok(PAINTED_ART.crops.cotton.includes("plant_cotton_stages.png"));
  assert.ok(PAINTED_ART.crops.strawberry.includes("v=3blossom"));
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

test("cover scale uses 80% of the first soil-disc pass", () => {
  const zoom = cropCoverScale("corn", 1, ZOOM_MOUND_COVER_PX);
  const farm = cropCoverScale("corn", 1, FARM_MOUND_COVER_PX);
  const d = CROP_DISC_IN_CELL.corn[0]!.d;
  assert.ok(Math.abs(zoom * d - ZOOM_MOUND_COVER_PX) < 0.01);
  assert.ok(Math.abs(farm * d - FARM_MOUND_COVER_PX) < 0.01);
  assert.equal(ZOOM_MOUND_COVER_PX, 176);
  assert.equal(FARM_MOUND_COVER_PX, 64);
  const berry = cropCoverScale("strawberry", 4, ZOOM_MOUND_COVER_PX);
  const berryDisc = CROP_DISC_IN_CELL.strawberry[3]!.d;
  assert.ok(Math.abs(berry * berryDisc - ZOOM_MOUND_COVER_PX) < 0.01);
  assert.ok(CROP_DISC_IN_CELL.strawberry.every((disc) => disc.x > 180 && disc.x < 300));
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

test("barn corkboard and wanted poster sheet are farm props, not crop sheets", () => {
  assert.equal(PAINTED_ART.corkboard, "/art/painted/farm/corkboard.png");
  assert.equal(PAINTED_ART.wantedPoster, "/art/painted/farm/wanted_poster_sheet.png");
  assert.equal(WANTED_POSTER_SHEET.width, 1260);
  assert.equal(WANTED_POSTER_SHEET.height, 470);
  assert.equal(WANTED_POSTER_SHEET.frames, 4);
  assert.equal(CORKBOARD_HANG.y + CORKBOARD_HANG.h, 560);
  assert.ok(CORKBOARD_HANG.h < 814, "must not use the standing board full height");
  const rects = sheetFrameRects(WANTED_POSTER_SHEET.width, WANTED_POSTER_SHEET.height, WANTED_POSTER_SHEET.frames);
  assert.equal(rects.length, 4);
  for (let i = 1; i < rects.length; i++) {
    const prev = rects[i - 1]!;
    const r = rects[i]!;
    assert.ok(prev.x + prev.w <= r.x, "adjacent wanted frames must not share an x pixel");
  }
});

test("wanted poster frames crop to paper, dropping the painted cork plate", () => {
  const cell = WANTED_POSTER_SHEET.width / WANTED_POSTER_SHEET.frames;
  const paper = wantedPosterFrameRects();
  assert.equal(paper.length, 4);
  assert.equal(WANTED_POSTER_PAPER_INSET.x, 28);
  assert.equal(WANTED_POSTER_PAPER_INSET.y, 20);
  assert.ok(WANTED_POSTER_PAPER_INSET.w < cell - 24, "drop left/right cork");
  assert.ok(WANTED_POSTER_PAPER_INSET.h < WANTED_POSTER_SHEET.height - 40, "drop top/bottom cork");
  for (let i = 0; i < paper.length; i++) {
    const r = paper[i]!;
    assert.equal(r.x, i * cell + WANTED_POSTER_PAPER_INSET.x);
    assert.equal(r.y, WANTED_POSTER_PAPER_INSET.y);
    assert.equal(r.w, WANTED_POSTER_PAPER_INSET.w);
    assert.equal(r.h, WANTED_POSTER_PAPER_INSET.h);
    assert.ok(r.x >= i * cell);
    assert.ok(r.x + r.w <= (i + 1) * cell);
    assert.ok(r.y + r.h <= WANTED_POSTER_SHEET.height);
    if (i > 0) {
      assert.ok(paper[i - 1]!.x + paper[i - 1]!.w <= r.x, "paper frames must not overlap");
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
