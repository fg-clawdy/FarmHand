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
  assert.ok(PLANTED_FOOT_ANCHOR.pumpkin.y >= 0.90);
  assert.ok(PLANTED_FOOT_ANCHOR.strawberry.y >= 0.88);
  assert.ok(PLANTED_FOOT_ANCHOR.cotton.y >= PLANTED_FOOT_ANCHOR.pumpkin.y);
  assert.ok(plantedFootAnchor("pumpkin").y < 1);
  assert.equal(plantedFootAnchor(null).y, 1);
});

test("planted disc hide leaves fruit belt intact", () => {
  // Bushy fruit overlaps the cookie — hard-hide must stay tiny.
  assert.ok(PLANTED_DISC_HIDE_BY_SILHOUETTE.bushy <= 0.12);
  assert.ok(PLANTED_DISC_HIDE_BY_SILHOUETTE.tall <= 0.42);
  assert.ok(PLANTED_DISC_HIDE_FRAC <= 0.30);
  assert.ok(PLANTED_FOOT_FADE_BY_SILHOUETTE.bushy <= 0.22);
  assert.ok(PLANTED_FOOT_FADE_BY_SILHOUETTE.bushy >= 0.10);
  assert.ok(PLANTED_FOOT_FADE_BY_SILHOUETTE.tall <= 0.22);
});

test("bushy planted hide tops keep ripe fruit", () => {
  assert.ok((BUSHY_PLANTED_HIDE_TOP.pumpkin?.[3] ?? 0) >= 790);
  assert.ok((BUSHY_PLANTED_HIDE_TOP.strawberry?.[3] ?? 0) >= 370);
});
