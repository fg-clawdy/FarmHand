-- Chore board HEAT: append-only events + farm-wide aggregated heat scores (0–100).

CREATE TYPE "ChoreBoardEventType" AS ENUM ('BOARD_OPEN', 'CLAIM', 'DISMISS', 'RIGHT_NOW_IMPRESSION');
CREATE TYPE "ChoreBoardTimeBucket" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');
CREATE TYPE "ChoreBoardSource" AS ENUM ('GARDEN_JOB_BOARD', 'FARM_CORKBOARD');

CREATE TABLE "ChoreBoardEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "familyTimezone" TEXT,
    "playerId" TEXT,
    "choreId" TEXT,
    "eventType" "ChoreBoardEventType" NOT NULL,
    "timeOfDayBucket" "ChoreBoardTimeBucket" NOT NULL,
    "isWeekend" BOOLEAN NOT NULL,
    "source" "ChoreBoardSource" NOT NULL,
    "suggestedSlot" BOOLEAN,
    "meta" JSONB,
    CONSTRAINT "ChoreBoardEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChoreHeat" (
    "id" TEXT NOT NULL,
    "choreId" TEXT NOT NULL,
    "playerId" TEXT,
    "heatScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "claimCount7d" INTEGER NOT NULL DEFAULT 0,
    "claimCount30d" INTEGER NOT NULL DEFAULT 0,
    "openCount7d" INTEGER NOT NULL DEFAULT 0,
    "lastClaimedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChoreHeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChoreHeat_choreId_key" ON "ChoreHeat"("choreId");
CREATE INDEX "ChoreBoardEvent_createdAt_idx" ON "ChoreBoardEvent"("createdAt");
CREATE INDEX "ChoreBoardEvent_choreId_eventType_createdAt_idx" ON "ChoreBoardEvent"("choreId", "eventType", "createdAt");
CREATE INDEX "ChoreBoardEvent_eventType_createdAt_idx" ON "ChoreBoardEvent"("eventType", "createdAt");
CREATE INDEX "ChoreHeat_updatedAt_idx" ON "ChoreHeat"("updatedAt");

ALTER TABLE "ChoreBoardEvent" ADD CONSTRAINT "ChoreBoardEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChoreBoardEvent" ADD CONSTRAINT "ChoreBoardEvent_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChoreHeat" ADD CONSTRAINT "ChoreHeat_choreId_fkey" FOREIGN KEY ("choreId") REFERENCES "Chore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChoreHeat" ADD CONSTRAINT "ChoreHeat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
