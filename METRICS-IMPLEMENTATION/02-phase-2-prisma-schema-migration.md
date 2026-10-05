# Phase 2 — Prisma schema & non-destructive migration (currency → `points`)

Paste this entire document into a fresh agent session. Work in the repo root
`c:\Users\theha\Documents\GIT\FarmHand`.

## Objective

Rename the DB currency objects from "stars" to "points" **non-destructively** (no data
loss): the ledger enum/table, the store price/hold columns, and the shared-goal target
column. Then regenerate the Prisma client so Phases 3+ can use `pointLedgerEvent`,
`pointCost`, `pointsHeld`, `targetPoints`, `PointLedgerKind`.

> Context: current schema is `apps/api/prisma/schema.prisma`; latest applied migration is
> `20261003000000_give_ceiling_100`. `Player.points` already exists and is canonical.

## Exact schema edits (`apps/api/prisma/schema.prisma`)

| Line (current) | From | To |
|---|---|---|
| 71 | `enum StarLedgerKind` | `enum PointLedgerKind` |
| 148 | `starLedger              StarLedgerEvent[]` | `pointLedger             PointLedgerEvent[]` |
| 390 | `starCost     Int` | `pointCost    Int` |
| 408 | `starCost          Int` | `pointCost         Int` |
| 409 | `starsHeld         Int` | `pointsHeld        Int` |
| 421 | `ledgerEvents      StarLedgerEvent[]` | `ledgerEvents      PointLedgerEvent[]` |
| 440 | `model StarLedgerEvent` | `model PointLedgerEvent` |
| 444 | `kind            StarLedgerKind` | `kind            PointLedgerKind` |
| 551 | `targetStars  Int` | `targetPoints Int` |

Notes:
- There are **no** `@map` / `@@map` directives on `StarLedgerEvent`, so the table name
  equals the model name (`PointLedgerEvent`) and the enum type equals the enum name.
- The back-relation field name `StoreRedemption.ledgerEvents` (line 421) keeps its name;
  only its *type* changes.
- The unnamed relations (`Player.pointLedger` ↔ `PointLedgerEvent.player`,
  `StoreRedemption.ledgerEvents` ↔ `PointLedgerEvent.redemption`) need no `@relation`
  name changes — Prisma infers them from the field/type change.
- Do not touch `Player.points`, `StoreRewardEvent`, `SharedGoalEvent.amount`, or any
  `start…` field.

Verify with: `Select-String -Path apps/api/prisma/schema.prisma -Pattern 'star'` should
return **zero** currency hits after this step.

## Write the migration (non-destructive, hand-written)

Create a new migration folder:
`apps/api/prisma/migrations/20261004000000_points_currency/migration.sql`

Use the ordering-agnostic approach `npx prisma migrate dev --create-only --name points_currency`
to get a shell, then **replace its generated SQL entirely** with the statements below.
(The generated SQL will be destructive DROP+CREATE — never apply it as-is.)

```sql
-- Rename the enum type. The "kind" column follows automatically.
ALTER TYPE "StarLedgerKind" RENAME TO "PointLedgerKind";

-- Rename the ledger table.
ALTER TABLE "StarLedgerEvent" RENAME TO "PointLedgerEvent";

-- Rename any index/constraint that still carries the old name.
-- PostgreSQL auto-renames some of these when the table is renamed, so each
-- statement below is written to be safe to skip if its source name no longer
-- exists. Apply all of them; if one raises "does not exist", skip it.
ALTER INDEX     "StarLedgerEvent_idempotencyKey_key"        RENAME TO "PointLedgerEvent_idempotencyKey_key";
ALTER INDEX     "StarLedgerEvent_playerId_createdAt_idx"    RENAME TO "PointLedgerEvent_playerId_createdAt_idx";
ALTER INDEX     "StarLedgerEvent_playerId_kind_idx"         RENAME TO "PointLedgerEvent_playerId_kind_idx";
ALTER TABLE     "PointLedgerEvent" RENAME CONSTRAINT "StarLedgerEvent_pkey"                 TO "PointLedgerEvent_pkey";
ALTER TABLE     "PointLedgerEvent" RENAME CONSTRAINT "StarLedgerEvent_playerId_fkey"        TO "PointLedgerEvent_playerId_fkey";
ALTER TABLE     "PointLedgerEvent" RENAME CONSTRAINT "StarLedgerEvent_redemptionId_fkey"    TO "PointLedgerEvent_redemptionId_fkey";

-- Rename store / shared-goal columns.
ALTER TABLE "StoreSku"          RENAME COLUMN "starCost"    TO "pointCost";
ALTER TABLE "StoreRedemption"   RENAME COLUMN "starCost"    TO "pointCost";
ALTER TABLE "StoreRedemption"   RENAME COLUMN "starsHeld"   TO "pointsHeld";
ALTER TABLE "SharedGoal"        RENAME COLUMN "targetStars" TO "targetPoints";
```

If PostgreSQL reports the PK/FK constraint renames as already-done (because the table
rename auto-renamed them), that is fine — the `migrate diff` gate below is authoritative.

## Apply + regenerate

Run from `apps/api`:
```
npx prisma migrate dev    # applies the migration (requires DATABASE_URL)
npx prisma generate       # regenerates @prisma/client
```

## Verify zero drift (mandatory)

From `apps/api`:
```
npx prisma migrate diff --from-migrations ./prisma/migrations --to-schema-datamodel ./prisma/schema.prisma --exit-code
```
This must exit **0** (empty diff). If it lists SQL, your hand-written migration missed
something (a constraint/index name difference is the usual culprit) — fix the migration,
roll back the dev DB or use a fresh DB, and re-apply until the diff is empty.

Confirm the generated client exposes the new surface (e.g. via a quick
`grep -r pointLedgerEvent node_modules/.prisma/client/index.d.ts`).

## Definition of done

- `schema.prisma` uses `PointLedgerKind`, `PointLedgerEvent`, `pointCost`, `pointsHeld`,
  `targetPoints`, and `Player.pointLedger`.
- The hand-written migration applies cleanly with **no data loss** (all ALTER/RENAME).
- `prisma migrate diff` reports **zero** drift.
- The Prisma client is regenerated and exposes `pointLedgerEvent` / `PointLedgerKind`.

> Phase 2 typecheck note: `npm run build -w @farmhand/api` will **not** pass yet — the API
> source still references the old `starLedgerEvent` / `starCost` / `starsHeld` names.
> That is fixed in Phase 3, which must run next.