import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { computePointsFromLedger } from "@farmhand/shared";

/**
 * Stage 1 reconciliation test: verify that Player.points always equals
 * the wallet balance computed from the PointLedger.
 *
 * This test runs against the real database — it requires a running
 * Postgres with the migration applied.
 *
 * Run with: npx tsx --test src/reconciliation.test.ts
 */

// Canonical wallet computed directly from the ledger via the shared
// single source of truth (computePointsFromLedger). Kept independent of
// points.ts's playerWallet so a drift in Player.points that disagrees with
// the ledger is caught by the assertion below.
async function walletFromLedger(
  tx: Prisma.TransactionClient,
  playerId: string,
): Promise<{ points: number }> {
  const lines = await tx.pointLedgerEvent.findMany({
    where: { playerId },
    select: { kind: true, amount: true },
  });
  return { points: computePointsFromLedger(lines) };
}

describe("Point reconciliation", () => {
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

      const delta = Math.abs(player.points - wallet.points);
      assert.equal(
        player.points,
        wallet.points,
        `Player ${player.name} (${player.id}): points=${player.points} but ledger=${wallet.points} (delta=${delta}). Ledger events may be out of sync.`,
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
