-- Per-chore claim windows, in minutes since midnight (family timezone).
-- NULL bound = open (start NULL -> from midnight, end NULL -> until midnight).
-- An end earlier than the start wraps overnight; 1440 means "through midnight".
ALTER TABLE "Chore" ADD COLUMN "claimWindowStart" INTEGER;
ALTER TABLE "Chore" ADD COLUMN "claimWindowEnd" INTEGER;
