-- AlterTable
ALTER TABLE "Player" ADD COLUMN "provisionalSeeds" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: make slot and plantTier nullable on ChoreClaim
ALTER TABLE "ChoreClaim" ALTER COLUMN "slot" DROP NOT NULL;
ALTER TABLE "ChoreClaim" ALTER COLUMN "plantTier" DROP NOT NULL;
