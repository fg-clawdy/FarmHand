import assert from "node:assert/strict";
import test from "node:test";
import {
  CHORE_GENERIC_SLUG,
  PAINTED_CHORE_ART_BUST,
  paintedChoreArtSlug,
  paintedChoreArtUrl,
} from "./chorePaintedArt.ts";

test("paintedChoreArtSlug maps catalog slugs and falls back", () => {
  assert.equal(paintedChoreArtSlug("dishes-1-6"), "dishes-1-6");
  assert.equal(paintedChoreArtSlug("shoes-on-rack"), "shoes-on-rack");
  assert.equal(paintedChoreArtSlug("chore-generic"), CHORE_GENERIC_SLUG);
  assert.equal(paintedChoreArtSlug("nope"), CHORE_GENERIC_SLUG);
  assert.equal(paintedChoreArtSlug(""), CHORE_GENERIC_SLUG);
  assert.equal(paintedChoreArtSlug(null), CHORE_GENERIC_SLUG);
});

test("paintedChoreArtUrl uses painted chores path and cache bust", () => {
  assert.equal(
    paintedChoreArtUrl("dishes-1-6"),
    `/art/painted/chores/dishes-1-6.png?v=${PAINTED_CHORE_ART_BUST}`,
  );
  assert.equal(
    paintedChoreArtUrl("unknown-chore"),
    `/art/painted/chores/${CHORE_GENERIC_SLUG}.png?v=${PAINTED_CHORE_ART_BUST}`,
  );
});
