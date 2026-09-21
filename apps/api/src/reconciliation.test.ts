import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";

/**
 * Stage 1 reconciliation test: verify that Player.points always equals
 * the wallet balance computed from the StarLedger.
 *
 * This test runs against the real database — it requires a running
 * Postgres with the migration applied.
 *
 * Run with: npx tsx --test src/reconciliation.test.ts
 */

// Lightweight wallet computation that mirrors stars.ts playerWallet
// but stays independent so a bug in stars.ts doesn't mask a reconciliation
// failure.
async function walletFromLedger(
  tx: Prisma.TransactionClient,
  playerId: string,
): Promise<{ currentStars: number }> {
  const events = await tx.starLedgerEvent.findMany({
    where: { playerId },
    orderBy: { createdAt: "asc" },
  });

  // Each event's amount reflects the delta for that kind.
  // EARN_HARVEST / EARN_GRANT / OPENING_BALANCE: +amount
  // HOLD_REWARD: -amount (held, not yet spent)
  // RELEASE_REWARD: +amount (hold released back)
  // SPEND_REWARD: spent — hold was already deducted at request time,
  //   so this does not change currentStars (the hold already reduced it)
  // ADJUST_ADMIN: +amount (can be negative)
  let currentStars = 0;
  for (const ev of events) {
    switch (ev.kind) {
      case "EARN_HARVEST":
      case "EARN_GRANT":
      case "OPENING_BALANCE":
        currentStars += ev.amount;
        break;
      case "HOLD_REWARD":
        currentStars -= ev.amount;
        break;
      case "RELEASE_REWARD":
        currentStars += ev.amount;
        break;
      case "SPEND_REWARD":
        // Hold was already deducted; no further change to currentStars.
        break;
      case "ADJUST_ADMIN":
        currentStars += ev.amount;
        break;
    }
  }
  return { currentStars };
}

describe("Star reconciliation", () => {
  it("Player.points equals walletFromLedger for every active player", { skip: !process.env.DATABASE_URL }, async () => {
    // This test is skipped unless DATABASE_URL is set, since it
    // requires a running database. In CI, connect to the test DB.
    const { prisma } = await import("./db.js");

    const players = await prisma.player.findMany({ where: { isActive: true } });
    assert.ok(players.length > 0, "Need at least one active player to reconcile");

    for (const player of players) {
      const wallet = await prisma.$transaction(async (tx) =>
        walletFromLedger(tx, player.id),
      );

      const delta = Math.abs(player.points - wallet.currentStars);
      assert.equal(
        player.points,
        wallet.currentStars,
        `Player ${player.name} (${player.id}): points=${player.points} but ledger=${wallet.currentStars} (delta=${delta}). Ledger events may be out of sync.`,
      );
    }
  });

  it("no player has negative points", { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("./db.js");
    const bad = await prisma.player.findFirst({
      where: { points: { lt: 0 } },
    });
    assert.equal(bad, null, `Player ${bad?.name} (${bad?.id}) has negative points: ${bad?.points}`);
  });

  it("no player has negative seeds", { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("./db.js");
    const bad = await prisma.player.findFirst({
      where: { seeds: { lt: 0 } },
    });
    assert.equal(bad, null, `Player ${bad?.name} (${bad?.id}) has negative seeds: ${bad?.seeds}`);
  });

  it("no player has negative fertilizer", { skip: !process.env.DATABASE_URL }, async () => {
    const { prisma } = await import("./db.js");
    const bad = await prisma.player.findFirst({
      where: { fertilizer: { lt: 0 } },
    });
    assert.equal(bad, null, `Player ${bad?.name} (${bad?.id}) has negative fertilizer: ${bad?.fertilizer}`);
  });
});
