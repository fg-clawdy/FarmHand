-- Catalog difficulties were never copied onto chores seeded before the
-- difficulty column existed. resolveSeedReward treats a null difficulty as
-- 1 seed, so every claim button showed "+1 seed".
-- Only fill rows that still have no difficulty and no parent seedReward override.

UPDATE "Chore" SET "difficulty" = 1 WHERE "slug" = 'make-your-bed' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 4 WHERE "slug" = 'clean-your-room' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 2 WHERE "slug" = 'brush-teeth-am' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 2 WHERE "slug" = 'brush-teeth-bedtime' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 4 WHERE "slug" = 'dishes-1-6' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 2 WHERE "slug" = 'hang-backpack' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 2 WHERE "slug" = 'shoes-on-rack' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 2 WHERE "slug" = 'water-bottle-backpack' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 5 WHERE "slug" = 'do-homework' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 2 WHERE "slug" = 'clean-snack-mess' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 4 WHERE "slug" = 'feed-dog-am' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 4 WHERE "slug" = 'feed-dog-pm' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 7 WHERE "slug" = 'walk-the-dog' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 4 WHERE "slug" = 'take-out-trash' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 5 WHERE "slug" = 'put-up-clean-laundry' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 3 WHERE "slug" = 'brush-your-hair' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 2 WHERE "slug" = 'set-out-school-clothes' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 6 WHERE "slug" = 'easy-bedtime' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 7 WHERE "slug" = 'clean-living-room' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 4 WHERE "slug" = 'clean-dining-room' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 3 WHERE "slug" = 'clean-shoe-room' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 7 WHERE "slug" = 'clean-formal-living' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 4 WHERE "slug" = 'clean-formal-dining' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 2 WHERE "slug" = 'clean-table' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 9 WHERE "slug" = 'sweep-and-vacuum-downstairs' AND "difficulty" IS NULL AND "seedReward" IS NULL;
UPDATE "Chore" SET "difficulty" = 9 WHERE "slug" = 'mop-the-downstairs' AND "difficulty" IS NULL AND "seedReward" IS NULL;
