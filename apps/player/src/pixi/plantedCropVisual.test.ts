import assert from "node:assert/strict";
import test from "node:test";
import {
  CROP_SINK_FRAC,
  CROP_SINK_FRAC_BY_KIND,
  PLANTED_FOOT_ANCHOR,
  cropSinkFrac,
  cropSilhouette,
  plantedFootAnchor,
} from "./plantedCropVisual.ts";
import {
  PLANTED_DISC_HIDE_BY_SILHOUETTE,
  PLANTED_DISC_HIDE_FRAC,
  PLANTED_FOOT_FADE_BY_SILHOUETTE,
  BUSHY_PLANTED_HIDE_TOP,
  TALL_PLANTED_HIDE_TOP,
} from "./paintedAssets.ts";

test("planted sink nests bushy fruit into the mound", () => {
  assert.equal(cropSilhouette("pumpkin"), "bushy");
  assert.equal(cropSilhouette("strawberry"), "bushy");
  assert.equal(cropSilhouette("cotton"), "tall");
  assert.equal(cropSilhouette("corn"), "tall");
  assert.ok(CROP_SINK_FRAC.bushy.ripe > 0);
  assert.ok(CROP_SINK_FRAC.bushy.ripe <= 0.14);
  assert.ok(CROP_SINK_FRAC.tall.ripe > 0);
  assert.ok(CROP_SINK_FRAC.tall.ripe <= 0.12);
  assert.ok(cropSinkFrac(4, "pumpkin") > 0);
  assert.ok(cropSinkFrac(4, "strawberry") > 0);
  assert.ok(cropSinkFrac(4, "corn") > 0);
  assert.ok((CROP_SINK_FRAC_BY_KIND.pumpkin?.ripe ?? 0) >= 0.20);
  assert.ok((CROP_SINK_FRAC_BY_KIND.strawberry?.ripe ?? 0) >= 0.18);
});

test("planted foot anchors sit above texture bottom for soft fade", () => {
  for (const kind of Object.keys(PLANTED_FOOT_ANCHOR) as (keyof typeof PLANTED_FOOT_ANCHOR)[]) {
    const a = PLANTED_FOOT_ANCHOR[kind];
    assert.equal(a.x, 0.5);
    assert.ok(a.y >= 0.88 && a.y < 1, `${kind} foot y=${a.y}`);
  }
  assert.ok(PLANTED_FOOT_ANCHOR.pumpkin.y >= 0.94);
  assert.ok(PLANTED_FOOT_ANCHOR.strawberry.y >= 0.93);
  assert.ok(PLANTED_FOOT_ANCHOR.cotton.y >= PLANTED_FOOT_ANCHOR.pumpkin.y);
  assert.ok(PLANTED_FOOT_ANCHOR.corn.y >= 0.96);
  assert.ok(PLANTED_FOOT_ANCHOR.sunflower.y >= 0.96);
  assert.ok(plantedFootAnchor("pumpkin").y < 1);
  assert.equal(plantedFootAnchor(null).y, 1);
});

test("planted disc hide leaves fruit belt intact", () => {
  // Bushy fruit overlaps the cookie — hard-hide must stay tiny.
  assert.ok(PLANTED_DISC_HIDE_BY_SILHOUETTE.bushy <= 0.12);
  assert.ok(PLANTED_DISC_HIDE_BY_SILHOUETTE.tall <= 0.20);
  assert.ok(PLANTED_DISC_HIDE_FRAC <= 0.30);
  // Fade must span the baked disc above the seed, while soil-aware keeps kernels/fruit.
  assert.ok(PLANTED_FOOT_FADE_BY_SILHOUETTE.bushy <= 0.48);
  assert.ok(PLANTED_FOOT_FADE_BY_SILHOUETTE.bushy >= 0.28);
  assert.ok(PLANTED_FOOT_FADE_BY_SILHOUETTE.tall <= 0.48);
  assert.ok(PLANTED_FOOT_FADE_BY_SILHOUETTE.tall >= 0.28);
});

test("bushy planted hide tops keep ripe fruit", () => {
  assert.ok((BUSHY_PLANTED_HIDE_TOP.pumpkin?.[3] ?? 0) >= 790);
  assert.ok((BUSHY_PLANTED_HIDE_TOP.strawberry?.[3] ?? 0) >= 370);
});

test("seed and pumpkin grow clips sit below the plant, not through it", () => {
  // Corn kernels ~752–786; the old 0.40 disc clip was ~637 and deleted the seed.
  assert.ok((TALL_PLANTED_HIDE_TOP.corn?.[0] ?? 0) >= 790);
  assert.ok((TALL_PLANTED_HIDE_TOP.cotton?.[0] ?? 0) >= 530);
  assert.ok((TALL_PLANTED_HIDE_TOP.sunflower?.[0] ?? 0) >= 690);
  assert.ok((BUSHY_PLANTED_HIDE_TOP.strawberry?.[0] ?? 0) >= 385);
  // Pumpkin stage 2 (index 1) fruit bottoms near 799; 760 was cutting the gourd.
  assert.ok((BUSHY_PLANTED_HIDE_TOP.pumpkin?.[1] ?? 0) >= 810);
  assert.ok(cropSinkFrac(1, "corn") <= 0.03);
  assert.ok(cropSinkFrac(1, "cotton") <= 0.03);
  assert.ok(cropSinkFrac(1, "sunflower") <= 0.06);
  assert.ok(cropSinkFrac(1, "sunflower") >= 0.03);
  assert.ok(cropSinkFrac(2, "pumpkin") <= 0.08);
  assert.ok(cropSinkFrac(2, "pumpkin") >= 0.05);
  assert.ok(cropSinkFrac(2, "cotton") <= 0.05);
});
