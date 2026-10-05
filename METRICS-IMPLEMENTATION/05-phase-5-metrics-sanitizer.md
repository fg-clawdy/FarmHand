# Phase 5 — Point-canonical metrics sanitizer: reconcile gate + watermark + `SystemAlert`

Paste this entire document into a fresh agent session. Work in the repo root
`c:\Users\theha\Documents\GIT\FarmHand`.

## Objective

Guarantee the single currency is counted **exactly once**. After Phases 1–3, `Player.points`
is the stored balance and the append-only `PointLedgerEvent` is the source of truth. This
phase adds a **reconcile-before-publish gate**: before any metric/stat is emitted, the
stored `Player.points` is checked against `computePointsFromLedger(...)`. On mismatch the
system raises a `SystemAlert` and refuses to publish the corrupt number (optionally
repairing the stored value to the ledger). All reconciliation runs are recorded
append-only with a **watermark** so work is idempotent and auditable.

**Prerequisite:** Phases 1–3 are complete (`computePointsFromLedger` in shared,
`computePointsForPlayer` in `apps/api/src/points.ts`, `PointLedgerEvent` in the DB).

## Invariants (do not violate)

1. **Single source of truth:** the balance is `computePointsFromLedger(lines)`; `Player.points`
   is a materialized cache of it and must equal it.
2. **Exactly-once counting:** every currency movement is a ledger row with a stable
   idempotency key written through `appendPointEvent` (already P2002-safe). No code path
   may both write `Player.points` directly *and* append a ledger row for the same event.
3. **Atomic writes:** any operation that moves currency runs inside one Serializable
   transaction (reuse `withSerializableRetry` from `apps/api/src/locks.ts`) that updates
   the ledger and `Player.points` together.
4. **Append-only runs + watermark:** reconciliation writes `PointsReconciliationRun` rows
   (never updates them) and records the high-water ledger key processed.
5. **Alert, don't silently correct:** on mismatch the sanitizer raises a `SystemAlert`
   and reports the delta. Repair is an explicit, audited action (`repair: true`).

## Step 1 — New Prisma models + migration

Add to `apps/api/prisma/schema.prisma`:

```prisma
enum SystemAlertStatus {
  OPEN
  RESOLVED
}

/// Raised when an invariant is violated (e.g. Player.points != ledger).
model SystemAlert {
  id         String            @id @default(uuid())
  kind       String
  severity   String            @default("warning") // "info" | "warning" | "critical"
  message    String
  details    Json?
  playerId   String?
  player     Player?           @relation(fields: [playerId], references: [id], onDelete: Cascade)
  status     SystemAlertStatus @default(OPEN)
  resolvedAt DateTime?
  createdAt  DateTime          @default(now())

  @@index([status, createdAt])
  @@index([kind, createdAt])
}

/// Append-only reconciliation run. One row per check. Watermark = ledgerHighWater.
model PointsReconciliationRun {
  id              String   @id @default(uuid())
  playerId        String
  player          Player   @relation(fields: [playerId], references: [id], onDelete: Cascade)
  ledgerPoints    Int
  storedPoints    Int
  matched         Boolean
  repaired        Boolean  @default(false)
  ledgerHighWater String?  // idempotencyKey of the newest ledger row processed
  createdAt       DateTime @default(now())

  @@index([playerId, createdAt])
}
```

Generate + apply (from `apps/api`):
```
npx prisma migrate dev --name points_reconciliation
npx prisma generate
```
This migration is purely additive (new tables) — Prisma's generated SQL is safe to apply
as-is. Verify with
`npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code`.

## Step 2 — Sanitizer module `apps/api/src/pointsReconciliation.ts`

```ts
import { Prisma } from "@prisma/client";
import { prisma } from "./db.js";
import { computePointsForPlayer } from "./points.js";

type Db = Prisma.TransactionClient | typeof prisma;

export type ReconcileOutcome =
  | { matched: true; points: number; repaired: false }
  | { matched: false; ledgerPoints: number; storedPoints: number; repaired: boolean; alertId: string };

export async function reconcilePointsForPlayer(
  tx: Db,
  playerId: string,
  opts: { repair?: boolean } = {},
): Promise<ReconcileOutcome> {
  // 1. canonical balance
  const ledgerPoints = await computePointsForPlayer(tx, playerId);
  // 2. stored cache
  const player = await tx.player.findUniqueOrThrow({ where: { id: playerId } });
  const storedPoints = player.points;

  // 3. highest ledger idempotency key processed (watermark)
  const newest = await tx.pointLedgerEvent.findFirst({
    where: { playerId },
    orderBy: { createdAt: "desc" },
    select: { idempotencyKey: true },
  });

  if (ledgerPoints === storedPoints) {
    await tx.pointsReconciliationRun.create({
      data: {
        playerId, ledgerPoints, storedPoints,
        matched: true, repaired: false,
        ledgerHighWater: newest?.idempotencyKey ?? null,
      },
    });
    return { matched: true, points: ledgerPoints, repaired: false };
  }

  if (opts.repair) {
    await tx.player.update({ where: { id: playerId }, data: { points: ledgerPoints } });
  }

  const alert = await tx.systemAlert.create({
    data: {
      kind: "POINT_LEDGER_MISMATCH",
      severity: "critical",
      message: `Player ${player.name} (${playerId}) stored points ${storedPoints} != ledger ${ledgerPoints}.`,
      details: { ledgerPoints, storedPoints, delta: ledgerPoints - storedPoints, repaired: opts.repair === true },
      playerId,
    },
  });

  await tx.pointsReconciliationRun.create({
    data: {
      playerId, ledgerPoints, storedPoints,
      matched: false,
      repaired: opts.repair === true,
      ledgerHighWater: newest?.idempotencyKey ?? null,
    },
  });

  return { matched: false, ledgerPoints, storedPoints, repaired: opts.repair === true, alertId: alert.id };
}
```

Add an atomic writer helper to the same module (single-writer rule):
```ts
/** Run fn in a serializable transaction; match existing lock/retry conventions. */
export async function withPointsTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
```
## Step 3 — Wire the reconcile-before-publish gate

Identify every code path that **publishes a points metric or child-facing balance** and
gate it: reconcile first, then if `matched`, use the canonical ledger value; if not
matched and not repaired, prefer the ledger value (`ledgerPoints`) and surface the alert.

Likely call sites (grep to confirm):
- `apps/api/src/profile.ts` (`playerWallet` → also run `reconcilePointsForPlayer`).
- `apps/api/src/adminStats.ts` and `apps/api/src/parentStats.ts` — any per-player points
  rollup must reconcile before summing (or sum from the ledger directly).
- `apps/api/src/playerReview.ts` (the `pointsEarned` KPI).
- `apps/api/src/sharedGoals.ts` (give/put-back responses read `playerWallet`).
- `apps/api/src/store.ts` (`playerStore` — the kid wallet HUD).

Add a convenience batch function:
```ts
export async function reconcileAllActivePlayers(opts?: { repair?: boolean }) {
  const players = await prisma.player.findMany({ where: { isActive: true }, select: { id: true } });
  const results = [];
  for (const p of players) {
    results.push(await prisma.$transaction((tx) => reconcilePointsForPlayer(tx, p.id, opts)));
  }
  return results;
}
```

## Step 4 — Minimal admin surface for `SystemAlert`

Add to `apps/api/src/routes/admin.ts` (existing admin auth pattern):
- `GET /api/admin/system-alerts` → list OPEN alerts (`kind`, `severity`, `message`,
  `playerId`, `player.name`, `details`, `createdAt`).
- `POST /api/admin/system-alerts/:id/resolve` → set `status = RESOLVED`, `resolvedAt = now()`;
  also record the action in `AuditLog` (reuse its existing shape).
- `POST /api/admin/reconcile-points` (optional but recommended) → body `{ repair?: boolean }`;
  runs `reconcileAllActivePlayers` and returns a count summary
  `{ checked, mismatches, repaired }`.

## Step 5 — Tests

- Unit (no DB): `apps/api/src/pointsReconciliation.test.ts` — test the *pure* decision by
  asserting `computePointsFromLedger` math with `GIVE_SHARED`/`RETURN_SHARED` and a
  deliberate mismatch fixture (you can factor the alert/run *branch* into a small pure
  helper that takes `{ledgerPoints, storedPoints}` and returns the decision object, then
  test that helper directly).
- Integration (skipped without `DATABASE_URL`, mirroring `reconciliation.test.ts`):
  - A player who gave to a jar still reconciles `matched: true` (GIVE/RETURN handled).
  - Manually set `player.points` wrong, run `reconcilePointsForPlayer(tx, id)` →
    `matched: false`, a `SystemAlert` row exists, a `PointsReconciliationRun` row with
    `matched: false` exists, and `repaired === false`.
  - Run with `{ repair: true }` → `Player.points` is corrected to the ledger value.

## Validation

From `apps/api`:
```
npx prisma generate
npm run build -w @farmhand/api
npm test -w @farmhand/api
```
`npx tsx --test src/reconciliation.test.ts src/pointsReconciliation.test.ts` should pass
when `DATABASE_URL` is set.

## Definition of done

- `SystemAlert` and `PointsReconciliationRun` tables exist (additive migration, zero drift).
- `pointsReconciliation.ts` exports `reconcilePointsForPlayer`, `reconcileAllActivePlayers`,
  and `withPointsTransaction`.
- All balance/metric publication paths reconcile first and never publish a stored value
  that disagrees with `computePointsFromLedger`.
- On mismatch a `SystemAlert` row is written (severity `critical`), a run row is appended,
  and repair only happens when explicitly requested.
- API builds, all tests green, and the reconciliation test passes against a live DB.