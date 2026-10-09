import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

describe("Shared Goals — wallet integration", () => {
  let walletFromLedger: typeof import("@farmhand/shared").walletFromLedger;

  before(async () => {
    const mod = await import("@farmhand/shared");
    walletFromLedger = mod.walletFromLedger;
  });

  it("GIVE_SHARED debits points without affecting lifetimeEarned", () => {
    const wallet = walletFromLedger(
      [
        { kind: "EARN_HARVEST", amount: 100 },
        { kind: "GIVE_SHARED", amount: 30 },
      ], 0);
    assert.equal(wallet.points, 70);
    assert.equal(wallet.lifetimeEarned, 100);
    assert.equal(wallet.lifetimeGiven, 30);
  });

  it("RETURN_SHARED credits points", () => {
    const wallet = walletFromLedger(
      [
        { kind: "EARN_HARVEST", amount: 100 },
        { kind: "GIVE_SHARED", amount: 30 },
        { kind: "RETURN_SHARED", amount: 30 },
      ], 0);
    assert.equal(wallet.points, 100);
    assert.equal(wallet.lifetimeGiven, 0);
  });

  it("held points reduce available for giving", () => {
    const wallet = walletFromLedger(
      [
        { kind: "EARN_HARVEST", amount: 100 },
        { kind: "GIVE_SHARED", amount: 30 },
      ], 20);
    assert.equal(wallet.availablePoints, 50);
  });

  it("points never goes negative", () => {
    const wallet = walletFromLedger(
      [
        { kind: "EARN_HARVEST", amount: 10 },
        { kind: "GIVE_SHARED", amount: 30 },
      ], 0);
    assert.equal(wallet.points, 0);
  });

  it("lifetimeGiven never goes negative", () => {
    const wallet = walletFromLedger(
      [
        { kind: "EARN_HARVEST", amount: 10 },
        { kind: "RETURN_SHARED", amount: 30 },
      ], 0);
    assert.equal(wallet.lifetimeGiven, 0);
  });

  it("GIVE_SHARED does not increase lifetimeSpent", () => {
    const wallet = walletFromLedger(
      [
        { kind: "EARN_HARVEST", amount: 100 },
        { kind: "SPEND_REWARD", amount: 20 },
        { kind: "GIVE_SHARED", amount: 30 },
      ], 0);
    assert.equal(wallet.lifetimeSpent, 20);
    assert.equal(wallet.lifetimeGiven, 30);
  });
});
