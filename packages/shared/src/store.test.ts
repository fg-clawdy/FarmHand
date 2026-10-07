import assert from "node:assert/strict";
import test from "node:test";
import {
  STARTER_STORE_CATALOG,
  availablePoints,
  canAfford,
  priceBreakdown,
  roundUpTo50,
  spendHeldPoints,
  pointCostForPriceCents,
  walletFromLedger,
} from "./store.js";

test("starter catalog is five real-world SKUs at the locked point prices", () => {
  assert.equal(STARTER_STORE_CATALOG.length, 5);
  const bySlug = Object.fromEntries(STARTER_STORE_CATALOG.map((row) => [row.slug, row]));
  assert.equal(bySlug["movie-night"]?.pointCost, 200);
  assert.equal(bySlug["ice-cream"]?.pointCost, 500);
  assert.equal(bySlug["netflix-month"]?.pointCost, 1000);
  assert.equal(bySlug["amazon-gift-card"]?.pointCost, 1000);
  assert.equal(bySlug["date-night"]?.pointCost, 2000);
});

test("available points are current unspent minus holds", () => {
  assert.equal(availablePoints(800, 500), 300);
  assert.equal(availablePoints(500, 500), 0);
  assert.equal(availablePoints(100, 500), 0);
});

test("a 500★ ice cream request is rejected when available is under 500", () => {
  assert.equal(canAfford(800, 0, 500), true);
  assert.equal(canAfford(800, 500, 500), false);
  assert.equal(canAfford(499, 0, 500), false);
});

test("approve spends the hold and never goes negative", () => {
  assert.equal(spendHeldPoints(2100, 2000), 100);
  assert.equal(spendHeldPoints(200, 500), 0);
});

test("lifetime earned stays put across hold, spend, and later harvest", () => {
  const earned = [{ kind: "EARN_HARVEST" as const, amount: 2100 }];
  const afterHold = walletFromLedger(earned, 2000);
  assert.equal(afterHold.lifetimeEarned, 2100);
  assert.equal(afterHold.availablePoints, 100);
  assert.equal(afterHold.points, 2100);
  assert.equal(afterHold.lifetimeSpent, 0);

  const afterApprove = walletFromLedger(
    [...earned, { kind: "SPEND_REWARD", amount: 2000 }],
    0,
  );
  assert.equal(afterApprove.lifetimeEarned, 2100);
  assert.equal(afterApprove.availablePoints, 100);
  assert.equal(afterApprove.points, 100);
  assert.equal(afterApprove.lifetimeSpent, 2000);

  const afterMoreEarn = walletFromLedger(
    [
      ...earned,
      { kind: "SPEND_REWARD", amount: 2000 },
      { kind: "EARN_HARVEST", amount: 100 },
    ],
    0,
  );
  assert.equal(afterMoreEarn.lifetimeEarned, 2200);
  assert.equal(afterMoreEarn.availablePoints, 200);

  const afterMovie = walletFromLedger(
    [
      ...earned,
      { kind: "SPEND_REWARD", amount: 2000 },
      { kind: "EARN_HARVEST", amount: 100 },
      { kind: "SPEND_REWARD", amount: 200 },
    ],
    0,
  );
  assert.equal(afterMovie.availablePoints, 0);
  assert.equal(afterMovie.lifetimeEarned, 2200);
  assert.equal(afterMovie.lifetimeSpent, 2200);
});

test("admin adjustments are not gameplay-earned", () => {
  const wallet = walletFromLedger(
    [
      { kind: "EARN_HARVEST", amount: 250 },
      { kind: "ADJUST_ADMIN", amount: 550 },
    ],
    0,
  );
  assert.equal(wallet.lifetimeEarnedHarvest, 250);
  assert.equal(wallet.lifetimeEarned, 250);
  assert.equal(wallet.points, 800);
  assert.equal(wallet.availablePoints, 800);
});

test("cannot redeem when short even by one point against catalog prices", () => {
  for (const sku of STARTER_STORE_CATALOG) {
    assert.equal(canAfford(sku.pointCost, 0, sku.pointCost), true);
    assert.equal(canAfford(sku.pointCost - 1, 0, sku.pointCost), false);
    assert.equal(canAfford(sku.pointCost, 1, sku.pointCost), false);
  }
});

test("zero or negative point costs are never affordable", () => {
  assert.equal(canAfford(1000, 0, 0), false);
  assert.equal(canAfford(1000, 0, -200), false);
});

test("wallet current points never go negative from over-spend lines", () => {
  const wallet = walletFromLedger(
    [
      { kind: "EARN_HARVEST", amount: 100 },
      { kind: "SPEND_REWARD", amount: 500 },
    ],
    0,
  );
  assert.equal(wallet.points, 0);
  assert.equal(wallet.availablePoints, 0);
  assert.equal(wallet.lifetimeSpent, 500);
});

test("roundUpTo50 rounds up to the nearest 50 cents", () => {
  assert.equal(roundUpTo50(0), 0);
  assert.equal(roundUpTo50(1), 50);
  assert.equal(roundUpTo50(49), 50);
  assert.equal(roundUpTo50(50), 50);
  assert.equal(roundUpTo50(51), 100);
  assert.equal(roundUpTo50(100), 100);
  assert.equal(roundUpTo50(2474), 2500);
});

test("point cost = price + 10% tax rounded up to 50c, 1 point = 1 cent", () => {
  assert.equal(pointCostForPriceCents(2299), 2550);
  assert.equal(pointCostForPriceCents(0), 0);
  assert.equal(pointCostForPriceCents(1), 50);
  assert.equal(pointCostForPriceCents(49), 100);
  assert.equal(pointCostForPriceCents(50), 100);
  assert.equal(pointCostForPriceCents(100), 150);
});

test("price breakdown totals match the point cost", () => {
  const b = priceBreakdown(2299);
  assert.equal(b.priceCents, 2299);
  assert.equal(b.taxCents, 230);
  assert.equal(b.totalCents, 2529);
  assert.equal(b.pointCost, 2550);
  assert.equal(b.pointCost, pointCostForPriceCents(b.priceCents));
});
