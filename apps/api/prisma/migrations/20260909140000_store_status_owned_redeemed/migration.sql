-- Prisma cannot use a newly added enum value in the same transaction.
-- Add OWNED / REDEEMED first; the next migration converts FULFILLED rows.

ALTER TYPE "StoreRedemptionStatus" ADD VALUE 'OWNED';
ALTER TYPE "StoreRedemptionStatus" ADD VALUE 'REDEEMED';
