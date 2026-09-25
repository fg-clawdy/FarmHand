-- Pending-plant claims: durable Plot↔ChoreClaim links, seed accounting, notify rate limit.
ALTER TABLE "Player" ADD COLUMN IF NOT EXISTS "lastParentNotifyAt" TIMESTAMP(3);

ALTER TABLE "ChoreClaim" ADD COLUMN IF NOT EXISTS "seedsGranted" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ChoreClaim" ADD COLUMN IF NOT EXISTS "seedsPlanted" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PlotClaimLink" (
    "id" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "seedsUsed" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlotClaimLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlotClaimLink_plotId_claimId_key" ON "PlotClaimLink"("plotId", "claimId");
CREATE INDEX IF NOT EXISTS "PlotClaimLink_claimId_idx" ON "PlotClaimLink"("claimId");

DO $$ BEGIN
  ALTER TABLE "PlotClaimLink" ADD CONSTRAINT "PlotClaimLink_plotId_fkey"
    FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PlotClaimLink" ADD CONSTRAINT "PlotClaimLink_claimId_fkey"
    FOREIGN KEY ("claimId") REFERENCES "ChoreClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill links from legacy 1:1 Plot.choreClaimId
INSERT INTO "PlotClaimLink" ("id", "plotId", "claimId", "seedsUsed", "createdAt")
SELECT gen_random_uuid()::text, p."id", p."choreClaimId", 1, CURRENT_TIMESTAMP
FROM "Plot" p
WHERE p."choreClaimId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "PlotClaimLink" l WHERE l."plotId" = p."id" AND l."claimId" = p."choreClaimId"
  );

UPDATE "ChoreClaim" c
SET "seedsPlanted" = GREATEST(c."seedsPlanted", 1)
WHERE EXISTS (SELECT 1 FROM "PlotClaimLink" l WHERE l."claimId" = c."id");

-- Old purgatory plants: start the growth clock; harvest remains gated by pending links.
UPDATE "Plot"
SET
  "phase" = 'growing',
  "plantedAt" = COALESCE("plantedAt", CURRENT_TIMESTAMP)
WHERE "phase" = 'purgatory' AND "plantTier" IS NOT NULL;
