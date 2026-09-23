-- Extend ChoreClaimStatus with SKIPPED for honest skip → +1 seed shard.
-- SKIPPED claims satisfy the period without provisional seeds or parent inbox.
ALTER TYPE "ChoreClaimStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';
