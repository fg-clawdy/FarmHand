-- CreateTable
CREATE TABLE "AccoladeCounter" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,
    "harvests" INTEGER NOT NULL DEFAULT 0,
    "waterings" INTEGER NOT NULL DEFAULT 0,
    "plantings" INTEGER NOT NULL DEFAULT 0,
    "selfies" INTEGER NOT NULL DEFAULT 0,
    "chorePhotos" INTEGER NOT NULL DEFAULT 0,
    "cropsMask" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccoladeCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccoladeActiveDay" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "dayKey" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL,

    CONSTRAINT "AccoladeActiveDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccoladeUnlock" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "seasonKey" TEXT NOT NULL DEFAULT '',
    "medal" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "blurb" TEXT NOT NULL DEFAULT '',
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccoladeUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccoladeCounter_playerId_seasonKey_key" ON "AccoladeCounter"("playerId", "seasonKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccoladeActiveDay_playerId_dayKey_key" ON "AccoladeActiveDay"("playerId", "dayKey");

-- CreateIndex
CREATE INDEX "AccoladeActiveDay_playerId_seasonKey_idx" ON "AccoladeActiveDay"("playerId", "seasonKey");

-- CreateIndex
CREATE UNIQUE INDEX "AccoladeUnlock_playerId_slug_seasonKey_medal_key" ON "AccoladeUnlock"("playerId", "slug", "seasonKey", "medal");

-- CreateIndex
CREATE INDEX "AccoladeUnlock_playerId_unlockedAt_idx" ON "AccoladeUnlock"("playerId", "unlockedAt");

-- AddForeignKey
ALTER TABLE "AccoladeCounter" ADD CONSTRAINT "AccoladeCounter_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccoladeActiveDay" ADD CONSTRAINT "AccoladeActiveDay_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccoladeUnlock" ADD CONSTRAINT "AccoladeUnlock_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
