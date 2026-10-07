import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computePointsFromLedger, type PointLedgerLine } from "@farmhand/shared";
import { decideReconciliation } from "./pointsReconciliation.js";

const line = (kind: PointLedgerLine["kind"], amount: number): PointLedgerLine => ({ kind, amount });

describe("computePointsFromLedger (shared source of truth)", () => {
  it("sums earnings and opening balance", () => {
    const points = computePointsFromLedger([
      line("EARN_HARVEST", 40),
      line("EARN_GRANT", 25),
      line("OPENING_BALANCE", 10),
    ]);
    assert.equal(points, 75);
  });

  it("deducts store spend and applies signed admin adjustments", () => {
    const points = computePointsFromLedger([
      line("OPENING_BALANCE", 100),
      line("SPEND_REWARD", 40),
      line("ADJUST_ADMIN", -5),
    ]);
    assert.equal(points, 55);
  });

  it("nets family-jar give/return and clamps at zero", () => {
    const points = computePointsFromLedger([
      line("OPENING_BALANCE", 60),
      line("GIVE_SHARED", 40),
      line("RETURN_SHARED", 10),
    ]);
    // 60 - (40 - 10) = 30
    assert.equal(points, 30);

    const overdrawn = computePointsFromLedger([
      line("OPENING_BALANCE", 10),
      line("GIVE_SHARED", 40),
    ]);
    assert.equal(overdrawn, 0);
  });
});

describe("decideReconciliation", () => {
  it("reports a match when stored equals ledger", () => {
    const decision = decideReconciliation(120, 120);
    assert.equal(decision.matched, true);
    assert.equal(decision.ledgerPoints, 120);
    assert.equal(decision.storedPoints, 120);
    assert.equal(decision.delta, 0);
  });

  it("reports a mismatch and a signed delta when stored drifts", () => {
    const decision = decideReconciliation(120, 90);
    assert.equal(decision.matched, false);
    assert.equal(decision.ledgerPoints, 120);
    assert.equal(decision.storedPoints, 90);
    assert.equal(decision.delta, 30); // ledger - stored
  });
});