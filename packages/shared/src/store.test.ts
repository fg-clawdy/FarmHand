import assert from "node:assert/strict";
import test from "node:test";
import {
  STARTER_STORE_CATALOG,
  availableStars,
  canAfford,
  spendHeldStars,
  walletFromLedger,
} from "./store.js";

test("starter catalog is five real-world SKUs at the locked star prices", () => {
  assert.equal(STARTER_STORE_CATALOG.length, 5);
  const bySlug = Object.fromEntries(STARTER_STORE_CATALOG.map((row) => [row.slug, row]));
  assert.equal(bySlug["movie-night"]?.starCost, 200);
  assert.equal(bySlug["ice-cream"]?.starCost, 500);
  assert.equal(bySlug["netflix-month"]?.starCost, 1000);
  assert.equal(bySlug["amazon-gift-card"]?.starCost, 1000);
  assert.equal(bySlug["date-night"]?.starCost, 2000);
});

test("available stars are current unspent minus holds", () => {
  assert.equal(availableStars(800, 500), 300);
  assert.equal(availableStars(500, 500), 0);
  assert.equal(availableStars(100, 500), 0);
});

test("a 500★ ice cream request is rejected when available is under 500", () => {
  assert.equal(canAfford(800, 0, 500), true);
  assert.equal(canAfford(800, 500, 500), false);
  assert.equal(canAfford(499, 0, 500), false);
});

test("approve spends the hold and never goes negative", () => {
  assert.equal(spendHeldStars(2100, 2000), 100);
  assert.equal(spendHeldStars(200, 500), 0);
});

test("lifetime earned stays put across hold, spend, and later harvest", () => {
  const earned = [{ kind: "EARN_HARVEST" as const, amount: 2100 }];
  const afterHold = walletFromLedger(earned, 2000);
  assert.equal(afterHold.lifetimeEarned, 2100);
  assert.equal(afterHold.availableStars, 100);
  assert.equal(afterHold.currentStars, 2100);
  assert.equal(afterHold.lifetimeSpent, 0);

  const afterApprove = walletFromLedger(
    [...earned, { kind: "SPEND_REWARD", amount: 2000 }],
    0,
  );
  assert.equal(afterApprove.lifetimeEarned, 2100);
  assert.equal(afterApprove.availableStars, 100);
  assert.equal(afterApprove.currentStars, 100);
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
  assert.equal(afterMoreEarn.availableStars, 200);

  const afterMovie = walletFromLedger(
    [
      ...earned,
      { kind: "SPEND_REWARD", amount: 2000 },
      { kind: "EARN_HARVEST", amount: 100 },
      { kind: "SPEND_REWARD", amount: 200 },
    ],
    0,
  );
  assert.equal(afterMovie.availableStars, 0);
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
  assert.equal(wallet.currentStars, 800);
  assert.equal(wallet.availableStars, 800);
});
