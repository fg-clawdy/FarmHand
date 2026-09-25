import assert from "node:assert/strict";
import test from "node:test";
import { basketLines, produceArtSrc } from "./HarvestBasketSheet";

test("groups mixed produce and sums points", () => {
  const lines = basketLines([
    { id: "a", kind: "corn", name: "Corn", emoji: "🌽", points: 10 },
    { id: "b", kind: "strawberry", name: "Strawberry", emoji: "🍓", points: 60 },
    { id: "c", kind: "corn", name: "Corn", emoji: "🌽", points: 10 },
    { id: "d", kind: "corn", name: "Corn", emoji: "🌽", points: 10 },
    { id: "e", kind: "strawberry", name: "Strawberry", emoji: "🍓", points: 60 },
  ]);
  assert.deepEqual(
    lines.map((line) => ({ name: line.name, count: line.count, points: line.points })),
    [
      { name: "Corn", count: 3, points: 30 },
      { name: "Strawberry", count: 2, points: 120 },
    ],
  );
});

test("maps crop kinds to painted produce art", () => {
  assert.match(produceArtSrc("corn") ?? "", /produce_sweet_corn\.png/);
  assert.match(produceArtSrc("sweet_corn") ?? "", /produce_sweet_corn\.png/);
  assert.match(produceArtSrc("sweetCorn") ?? "", /produce_sweet_corn\.png/);
  assert.match(produceArtSrc("cotton") ?? "", /produce_cotton\.png/);
  assert.match(produceArtSrc("sunflower") ?? "", /produce_sunflower\.png/);
});

test("falls back when no custom produce art", () => {
  assert.equal(produceArtSrc("strawberry"), null);
  assert.equal(produceArtSrc("tomato"), null);
  assert.equal(produceArtSrc("pumpkin"), null);
  assert.equal(produceArtSrc(""), null);
});
