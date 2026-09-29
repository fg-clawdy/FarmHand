import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PARENT_NOTIFY_COOLDOWN_MS,
  allocateProvisionalFromClaims,
  harvestBlockedWhilePending,
  parentNotifyGate,
  planSeedSpend,
} from "./seedSpend.js";

describe("planSeedSpend", () => {
  it("spends confirmed seeds first", () => {
    assert.deepEqual(planSeedSpend(4, 6, 3), { confirmedUsed: 3, provisionalUsed: 0 });
  });

  it("dips into provisional only after confirmed are exhausted", () => {
    assert.deepEqual(planSeedSpend(4, 6, 10), { confirmedUsed: 4, provisionalUsed: 6 });
  });

  it("rejects when total seeds are insufficient", () => {
    assert.throws(() => planSeedSpend(2, 3, 10), /Not enough seeds/);
  });
});

describe("allocateProvisionalFromClaims", () => {
  it("allocates FIFO across multi-seed claims", () => {
    const links = allocateProvisionalFromClaims(
      [
        { id: "a", seedsGranted: 2, seedsPlanted: 0 },
        { id: "b", seedsGranted: 5, seedsPlanted: 1 },
        { id: "c", seedsGranted: 3, seedsPlanted: 0 },
      ],
      6,
    );
    assert.deepEqual(links, [
      { claimId: "a", seedsUsed: 2 },
      { claimId: "b", seedsUsed: 4 },
    ]);
  });

  it("throws when pending claims cannot cover provisional need", () => {
    assert.throws(
      () => allocateProvisionalFromClaims([{ id: "a", seedsGranted: 1, seedsPlanted: 0 }], 3),
      /No pending chore claim/,
    );
  });
});

describe("harvestBlockedWhilePending", () => {
  it("blocks harvest while any linked claim is pending", () => {
    assert.equal(harvestBlockedWhilePending(2), true);
    assert.equal(harvestBlockedWhilePending(0), false);
  });
});

describe("parentNotifyGate", () => {
  it("allows when never notified", () => {
    const gate = parentNotifyGate(null, new Date("2026-09-25T12:00:00.000Z"));
    assert.equal(gate.allowed, true);
    assert.equal(gate.retryInMs, 0);
  });

  it("rate-limits to once per hour", () => {
    const last = new Date("2026-09-25T11:30:00.000Z");
    const now = new Date("2026-09-25T12:00:00.000Z");
    const gate = parentNotifyGate(last, now);
    assert.equal(gate.allowed, false);
    assert.equal(gate.retryInMs, 30 * 60 * 1000);
    assert.equal(gate.retryAt, new Date(last.getTime() + PARENT_NOTIFY_COOLDOWN_MS).toISOString());
  });

  it("allows again after the hour cooldown", () => {
    const last = new Date("2026-09-25T10:00:00.000Z");
    const now = new Date("2026-09-25T11:00:00.000Z");
    assert.equal(parentNotifyGate(last, now).allowed, true);
  });
});

describe("planSeedSpend integrity", () => {
  it("rejects non-finite or negative balances and costs", () => {
    assert.throws(() => planSeedSpend(-1, 0, 1), /Invalid confirmed/);
    assert.throws(() => planSeedSpend(0, -1, 1), /Invalid provisional/);
    assert.throws(() => planSeedSpend(1, 1, -1), /Invalid seed cost/);
    assert.throws(() => planSeedSpend(1, 1, Number.NaN), /Invalid seed cost/);
  });

  it("never spends more than the requested cost or available total", () => {
    const plan = planSeedSpend(2, 5, 4);
    assert.equal(plan.confirmedUsed + plan.provisionalUsed, 4);
    assert.ok(plan.confirmedUsed <= 2);
    assert.ok(plan.provisionalUsed <= 5);
    assert.throws(() => planSeedSpend(2, 5, 8), /Not enough seeds/);
  });

  it("zero-cost plan spends nothing", () => {
    assert.deepEqual(planSeedSpend(3, 4, 0), { confirmedUsed: 0, provisionalUsed: 0 });
  });
});

describe("allocateProvisionalFromClaims integrity", () => {
  it("never allocates more than available or requested", () => {
    const links = allocateProvisionalFromClaims(
      [
        { id: "a", seedsGranted: 3, seedsPlanted: 1 },
        { id: "b", seedsGranted: 2, seedsPlanted: 0 },
      ],
      3,
    );
    const used = links.reduce((n, row) => n + row.seedsUsed, 0);
    assert.equal(used, 3);
    assert.ok(links.every((row) => row.seedsUsed > 0));
    assert.throws(
      () =>
        allocateProvisionalFromClaims(
          [{ id: "a", seedsGranted: 2, seedsPlanted: 2 }],
          1,
        ),
      /No pending chore claim/,
    );
  });
});
