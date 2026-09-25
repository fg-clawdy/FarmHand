-- CreateTable
CREATE TABLE "BasketItem" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "cropKind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'held',
    "soldAt" TIMESTAMP(3),
    "saleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BasketItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BasketItem_playerId_status_createdAt_idx" ON "BasketItem"("playerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BasketItem_saleId_idx" ON "BasketItem"("saleId");

-- AddForeignKey
ALTER TABLE "BasketItem" ADD CONSTRAINT "BasketItem_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
