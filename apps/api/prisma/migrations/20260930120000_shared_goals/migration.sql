-- Family jar. Enum adds must be committed before use on older Postgres;
-- Prisma runs this file in one transaction, which PostgreSQL 12+ allows for ADD VALUE.

ALTER TYPE "StarLedgerKind" ADD VALUE IF NOT EXISTS 'GIVE_SHARED';
ALTER TYPE "StarLedgerKind" ADD VALUE IF NOT EXISTS 'RETURN_SHARED';

CREATE TYPE "SharedGoalStatus" AS ENUM ('WAITING', 'OPEN', 'READY', 'HAPPENED', 'CANCELLED');

ALTER TABLE "Player" ADD COLUMN "givingEnabled" BOOLEAN DEFAULT true;
ALTER TABLE "Player" ADD COLUMN "giveCeiling" INTEGER DEFAULT 20;
ALTER TABLE "Player" ADD COLUMN "familyJarCoachSeenAt" TIMESTAMP(3);

CREATE TABLE "SharedGoal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "targetStars" INTEGER NOT NULL,
    "status" "SharedGoalStatus" NOT NULL DEFAULT 'WAITING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "happenedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    CONSTRAINT "SharedGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SharedGoalEvent" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SharedGoalEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SharedGoalEvent_idempotencyKey_key" ON "SharedGoalEvent"("idempotencyKey");
CREATE INDEX "SharedGoal_status_createdAt_idx" ON "SharedGoal"("status", "createdAt");
CREATE INDEX "SharedGoal_status_sortOrder_idx" ON "SharedGoal"("status", "sortOrder");
CREATE INDEX "SharedGoalEvent_goalId_createdAt_idx" ON "SharedGoalEvent"("goalId", "createdAt");
CREATE INDEX "SharedGoalEvent_playerId_createdAt_idx" ON "SharedGoalEvent"("playerId", "createdAt");

ALTER TABLE "SharedGoalEvent" ADD CONSTRAINT "SharedGoalEvent_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "SharedGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedGoalEvent" ADD CONSTRAINT "SharedGoalEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
