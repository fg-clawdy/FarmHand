import assert from "node:assert/strict";
import test from "node:test";
import { STARTER_STORE_CATALOG, availableStars, canAfford, spendHeldStars } from "./store.js";

test("starter catalog is five real-world SKUs at the locked star prices", () => {
  assert.equal(STARTER_STORE_CATALOG.length, 5);
  const bySlug = Object.fromEntries(STARTER_STORE_CATALOG.map((row) => [row.slug, row]));
  assert.equal(bySlug["movie-night"]?.starCost, 200);
  assert.equal(bySlug["ice-cream"]?.starCost, 500);
  assert.equal(bySlug["netflix-month"]?.starCost, 1000);
  assert.equal(bySlug["amazon-gift-card"]?.starCost, 1000);
  assert.equal(bySlug["date-night"]?.starCost, 2000);
});

test("available stars are balance minus holds", () => {
  assert.equal(availableStars(800, 500), 300);
  assert.equal(availableStars(500, 500), 0);
  assert.equal(availableStars(100, 500), 0);
});

test("a 500★ ice cream request is rejected when available is under 500", () => {
  assert.equal(canAfford(800, 0, 500), true);
  assert.equal(canAfford(800, 500, 500), false);
  assert.equal(canAfford(499, 0, 500), false);
});

test("fulfill spends the hold and never goes negative", () => {
  assert.equal(spendHeldStars(800, 500), 300);
  assert.equal(spendHeldStars(200, 500), 0);
});
