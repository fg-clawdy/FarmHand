-- Pour chips are now 5 / 10 / 25 / 50 / 100, so the per-pour ceiling
-- default rises to 100. Existing rows still sitting on the old default of 20
-- are bumped so the new chips are usable; parents can lower them again.
ALTER TABLE "Player" ALTER COLUMN "giveCeiling" SET DEFAULT 100;

UPDATE "Player" SET "giveCeiling" = 100 WHERE "giveCeiling" = 20;