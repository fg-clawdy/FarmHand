-- CreateEnum
CREATE TYPE "StarLedgerKind" AS ENUM ('EARN_HARVEST', 'EARN_GRANT', 'HOLD_REWARD', 'RELEASE_REWARD', 'SPEND_REWARD', 'ADJUST_ADMIN', 'OPENING_BALANCE');

-- AlterTable
ALTER TABLE "StoreRedemption" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StoreRedemption" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "StoreRedemption" ADD COLUMN "deniedAt" TIMESTAMP(3);
ALTER TABLE "StoreRedemption" ADD COLUMN "denyReason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "StoreRedemption" ADD COLUMN "redeemedAt" TIMESTAMP(3);
ALTER TABLE "StoreRedemption" ADD COLUMN "redeemedByAdminId" TEXT;

-- Prior "fulfill" was parent approval/promise, not verified use.
UPDATE "StoreRedemption"
SET
  status = 'OWNED',
  "approvedAt" = "resolvedAt"
WHERE status = 'FULFILLED';

UPDATE "StoreRedemption"
SET "deniedAt" = "resolvedAt"
WHERE status = 'DENIED';

-- CreateTable
CREATE TABLE "StoreRewardEvent" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "adminId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreRewardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarLedgerEvent" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" "StarLedgerKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "redemptionId" TEXT,
    "source" TEXT NOT NULL DEFAULT '',
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StarLedgerEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreRewardEvent_redemptionId_createdAt_idx" ON "StoreRewardEvent"("redemptionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StarLedgerEvent_idempotencyKey_key" ON "StarLedgerEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StarLedgerEvent_playerId_createdAt_idx" ON "StarLedgerEvent"("playerId", "createdAt");

-- CreateIndex
CREATE INDEX "StarLedgerEvent_playerId_kind_idx" ON "StarLedgerEvent"("playerId", "kind");

-- AddForeignKey
ALTER TABLE "StoreRedemption" ADD CONSTRAINT "StoreRedemption_redeemedByAdminId_fkey" FOREIGN KEY ("redeemedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StoreRewardEvent" ADD CONSTRAINT "StoreRewardEvent_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "StoreRedemption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StarLedgerEvent" ADD CONSTRAINT "StarLedgerEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StarLedgerEvent" ADD CONSTRAINT "StarLedgerEvent_redemptionId_fkey" FOREIGN KEY ("redemptionId") REFERENCES "StoreRedemption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
