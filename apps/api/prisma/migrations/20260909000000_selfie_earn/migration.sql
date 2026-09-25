-- AlterTable
ALTER TABLE "Player" ADD COLUMN "selfieUnlockDate" TEXT;
ALTER TABLE "Player" ADD COLUMN "selfieSeedGrantDate" TEXT;

-- AlterTable
ALTER TABLE "Plot" ADD COLUMN "lastWateredAt" TIMESTAMP(3);
ALTER TABLE "Plot" ADD COLUMN "wateringsOnDate" TEXT;
ALTER TABLE "Plot" ADD COLUMN "wateringsCount" INTEGER NOT NULL DEFAULT 0;
