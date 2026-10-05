-- Amazon Wishlist Phase 1.
-- `WISHLIST_URLS` maps child name -> public wishlist URL (retailer inferred from host).
-- A weekly scrape upserts WishlistItem rows; parents confirm prices; kids see confirmed items.

-- CreateEnum
CREATE TYPE "WishlistItemStatus" AS ENUM ('PENDING', 'CONFIRMED', 'HIDDEN', 'PURCHASED');

-- AlterTable: Player stores its resolved wishlist URL + last sync timestamp.
ALTER TABLE "Player" ADD COLUMN "amazonWishlistUrl" TEXT;
ALTER TABLE "Player" ADD COLUMN "wishlistSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "retailer" TEXT NOT NULL DEFAULT 'amazon',
    "asin" TEXT,
    "title" TEXT NOT NULL,
    "productUrl" TEXT,
    "priceCents" INTEGER,
    "starCost" INTEGER,
    "status" "WishlistItemStatus" NOT NULL DEFAULT 'PENDING',
    "needsAttention" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishlistItem_playerId_status_idx" ON "WishlistItem"("playerId", "status");
CREATE INDEX "WishlistItem_playerId_retailer_asin_idx" ON "WishlistItem"("playerId", "retailer", "asin");

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: StoreRedemption gains wishlist linkage + a snapshotted product link.
ALTER TABLE "StoreRedemption" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'catalog';
ALTER TABLE "StoreRedemption" ADD COLUMN "wishlistItemId" TEXT;
ALTER TABLE "StoreRedemption" ADD COLUMN "productUrl" TEXT;

-- skuId becomes nullable so wishlist redemptions can live without a SKU,
-- and deleting a SKU no longer orphans the redemption (SET NULL instead of RESTRICT).
ALTER TABLE "StoreRedemption" DROP CONSTRAINT "StoreRedemption_skuId_fkey";
ALTER TABLE "StoreRedemption" ALTER COLUMN "skuId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "StoreRedemption" ADD CONSTRAINT "StoreRedemption_wishlistItemId_fkey" FOREIGN KEY ("wishlistItemId") REFERENCES "WishlistItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StoreRedemption" ADD CONSTRAINT "StoreRedemption_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "StoreSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;