-- Stage 1: CHECK constraints on Player resource columns.
-- These enforce non-negative invariants at the DB level so no code
-- path can silently drive a balance below zero.

-- 1. points (stars)
DO $$ BEGIN
  ALTER TABLE "Player" ADD CONSTRAINT "Player_points_check" CHECK ("points" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. seeds
DO $$ BEGIN
  ALTER TABLE "Player" ADD CONSTRAINT "Player_seeds_check" CHECK ("seeds" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. fertilizer
DO $$ BEGIN
  ALTER TABLE "Player" ADD CONSTRAINT "Player_fertilizer_check" CHECK ("fertilizer" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. moonDew
DO $$ BEGIN
  ALTER TABLE "Player" ADD CONSTRAINT "Player_moonDew_check" CHECK ("moonDew" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. growGoo
DO $$ BEGIN
  ALTER TABLE "Player" ADD CONSTRAINT "Player_growGoo_check" CHECK ("growGoo" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. phoenixAsh
DO $$ BEGIN
  ALTER TABLE "Player" ADD CONSTRAINT "Player_phoenixAsh_check" CHECK ("phoenixAsh" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
