-- Lid art for shared-goal jars. Create never waits on this pipeline.

CREATE TYPE "SharedGoalArtStatus" AS ENUM ('DEFAULT', 'QUEUED', 'READY', 'FAILED');

ALTER TABLE "SharedGoal" ADD COLUMN "tintIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SharedGoal" ADD COLUMN "artUrl" TEXT;
ALTER TABLE "SharedGoal" ADD COLUMN "artStatus" "SharedGoalArtStatus" NOT NULL DEFAULT 'DEFAULT';
ALTER TABLE "SharedGoal" ADD COLUMN "artPrompt" TEXT;
ALTER TABLE "SharedGoal" ADD COLUMN "artNotes" TEXT;
