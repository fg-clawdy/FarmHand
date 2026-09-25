-- CreateEnum
CREATE TYPE "StoreRedemptionStatus" AS ENUM ('PENDING', 'FULFILLED', 'DENIED');

-- CreateTable
CREATE TABLE "StoreSku" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "starCost" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreRedemption" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "skuId" TEXT NOT NULL,
    "status" "StoreRedemptionStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "starCost" INTEGER NOT NULL,
    "starsHeld" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" TEXT,

    CONSTRAINT "StoreRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSku_slug_key" ON "StoreSku"("slug");

-- CreateIndex
CREATE INDEX "StoreRedemption_playerId_status_idx" ON "StoreRedemption"("playerId", "status");

-- CreateIndex
CREATE INDEX "StoreRedemption_status_requestedAt_idx" ON "StoreRedemption"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "StoreRedemption" ADD CONSTRAINT "StoreRedemption_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRedemption" ADD CONSTRAINT "StoreRedemption_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "StoreSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreRedemption" ADD CONSTRAINT "StoreRedemption_resolvedByAdminId_fkey" FOREIGN KEY ("resolvedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
