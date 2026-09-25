-- CreateEnum
CREATE TYPE "PlotPhase" AS ENUM ('empty', 'growing', 'purgatory', 'wilted');

-- CreateEnum
CREATE TYPE "ChoreRecurrence" AS ENUM ('DAILY', 'WEEKLY', 'WEEKDAYS', 'NONE');

-- CreateEnum
CREATE TYPE "ChoreTimeOfDay" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'ANYTIME');

-- CreateEnum
CREATE TYPE "ChorePriority" AS ENUM ('CRITICAL', 'HIGH', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "ChoreAssignmentMode" AS ENUM ('ALL', 'SPECIFIC', 'RACE');

-- CreateEnum
CREATE TYPE "ChoreClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "Plot" ADD COLUMN "phase" "PlotPhase" NOT NULL DEFAULT 'empty';
ALTER TABLE "Plot" ADD COLUMN "choreClaimId" TEXT;

-- Backfill in-ground plants so existing gardens keep growing.
UPDATE "Plot" SET "phase" = 'growing' WHERE "plantedAt" IS NOT NULL AND "plantTier" IS NOT NULL;

-- CreateTable
CREATE TABLE "Chore" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "recurrence" "ChoreRecurrence" NOT NULL,
    "timeOfDay" "ChoreTimeOfDay" NOT NULL,
    "priority" "ChorePriority" NOT NULL DEFAULT 'NORMAL',
    "estimatedMinutes" INTEGER,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "requiresSelfie" BOOLEAN NOT NULL DEFAULT false,
    "allowsSkip" BOOLEAN NOT NULL DEFAULT false,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "includeInPath" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "legacyPoints" INTEGER,
    "assignmentMode" "ChoreAssignmentMode" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreAssignment" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreRaceSlot" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChoreRaceSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChoreClaim" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "status" "ChoreClaimStatus" NOT NULL DEFAULT 'PENDING',
    "slot" INTEGER NOT NULL,
    "plantTier" INTEGER NOT NULL,
    "proofJpegPath" TEXT,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" TEXT,

    CONSTRAINT "ChoreClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chore_slug_key" ON "Chore"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ChoreAssignment_choreId_playerId_key" ON "ChoreAssignment"("choreId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "ChoreRaceSlot_choreId_periodKey_key" ON "ChoreRaceSlot"("choreId", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChoreClaim_choreId_playerId_periodKey_key" ON "ChoreClaim"("choreId", "playerId", "periodKey");

-- CreateIndex
CREATE INDEX "ChoreClaim_status_claimedAt_idx" ON "ChoreClaim"("status", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Plot_choreClaimId_key" ON "Plot"("choreClaimId");

-- AddForeignKey
ALTER TABLE "Plot" ADD CONSTRAINT "Plot_choreClaimId_fkey" FOREIGN KEY ("choreClaimId") REFERENCES "ChoreClaim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreAssignment" ADD CONSTRAINT "ChoreAssignment_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreAssignment" ADD CONSTRAINT "ChoreAssignment_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreRaceSlot" ADD CONSTRAINT "ChoreRaceSlot_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreClaim" ADD CONSTRAINT "ChoreClaim_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreClaim" ADD CONSTRAINT "ChoreClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChoreClaim" ADD CONSTRAINT "ChoreClaim_resolvedByAdminId_fkey" FOREIGN KEY ("resolvedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
