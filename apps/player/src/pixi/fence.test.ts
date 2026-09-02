import assert from "node:assert/strict";
import test from "node:test";
import { fencePosts, fenceTouchesInterior, type PlotRect } from "./fenceLayout.ts";

test("fence ring is a single perimeter with corners, no interior fill", () => {
  const rect: PlotRect = { c0: 4, r0: 3, c1: 6, r1: 4 };
  const posts = fencePosts(rect);
  assert.equal(fenceTouchesInterior(posts, rect), false);

  const west = posts.filter((p) => p.col === rect.c0 - 1 && !p.flipX && p.row >= rect.r0 && p.row <= rect.r1);
  const east = posts.filter((p) => p.col === rect.c1 + 1 && !p.flipX && p.row >= rect.r0 && p.row <= rect.r1);
  const north = posts.filter((p) => p.row === rect.r0 - 1 && p.flipX && p.col >= rect.c0 && p.col <= rect.c1);
  const south = posts.filter((p) => p.row === rect.r1 + 1 && p.flipX && p.col >= rect.c0 && p.col <= rect.c1);
  assert.equal(west.length, 2);
  assert.equal(east.length, 2);
  assert.equal(north.length, 3);
  assert.equal(south.length, 3);

  const keys = posts.map((p) => `${p.col},${p.row},${p.flipX}`);
  assert.equal(keys.length, new Set(keys).size, "no duplicate posts");

  const corner = posts.filter((p) => p.col === rect.c0 - 1 && p.row === rect.r0 - 1);
  assert.equal(corner.length, 2);
  assert.ok(corner.some((p) => p.flipX) && corner.some((p) => !p.flipX));
});
