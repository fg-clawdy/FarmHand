-- CreateEnum
CREATE TYPE "SystemAlertStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "SystemAlert" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "playerId" TEXT,
    "status" "SystemAlertStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsReconciliationRun" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "ledgerPoints" INTEGER NOT NULL,
    "storedPoints" INTEGER NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "repaired" BOOLEAN NOT NULL DEFAULT false,
    "ledgerHighWater" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SystemAlert_status_createdAt_idx" ON "SystemAlert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "SystemAlert_kind_createdAt_idx" ON "SystemAlert"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "PointsReconciliationRun_playerId_createdAt_idx" ON "PointsReconciliationRun"("playerId", "createdAt");

-- AddForeignKey
ALTER TABLE "SystemAlert" ADD CONSTRAINT "SystemAlert_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsReconciliationRun" ADD CONSTRAINT "PointsReconciliationRun_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;