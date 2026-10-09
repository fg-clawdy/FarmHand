-- Rename the DB currency objects from "stars" to "points" (non-destructive:
-- every statement is an ALTER/RENAME; no rows are dropped or re-created).

-- Rename the enum type. The "kind" column follows automatically.
ALTER TYPE "StarLedgerKind" RENAME TO "PointLedgerKind";

-- Rename the ledger table (its composite row type follows automatically).
ALTER TABLE "StarLedgerEvent" RENAME TO "PointLedgerEvent";

-- Rename the indexes that still carry the old table prefix. PostgreSQL does not
-- rename indexes when the table is renamed, so these all reference existing names.
ALTER INDEX     "StarLedgerEvent_idempotencyKey_key"        RENAME TO "PointLedgerEvent_idempotencyKey_key";
ALTER INDEX     "StarLedgerEvent_playerId_createdAt_idx"    RENAME TO "PointLedgerEvent_playerId_createdAt_idx";
ALTER INDEX     "StarLedgerEvent_playerId_kind_idx"         RENAME TO "PointLedgerEvent_playerId_kind_idx";

-- Rename the primary/foreign-key constraints (still named after the old table).
ALTER TABLE     "PointLedgerEvent" RENAME CONSTRAINT "StarLedgerEvent_pkey"                 TO "PointLedgerEvent_pkey";
ALTER TABLE     "PointLedgerEvent" RENAME CONSTRAINT "StarLedgerEvent_playerId_fkey"        TO "PointLedgerEvent_playerId_fkey";
ALTER TABLE     "PointLedgerEvent" RENAME CONSTRAINT "StarLedgerEvent_redemptionId_fkey"    TO "PointLedgerEvent_redemptionId_fkey";

-- Rename store / shared-goal / wishlist price & hold columns.
ALTER TABLE "StoreSku"          RENAME COLUMN "starCost"    TO "pointCost";
ALTER TABLE "StoreRedemption"   RENAME COLUMN "starCost"    TO "pointCost";
ALTER TABLE "StoreRedemption"   RENAME COLUMN "starsHeld"   TO "pointsHeld";
ALTER TABLE "SharedGoal"        RENAME COLUMN "targetStars" TO "targetPoints";
ALTER TABLE "WishlistItem"      RENAME COLUMN "starCost"    TO "pointCost";
