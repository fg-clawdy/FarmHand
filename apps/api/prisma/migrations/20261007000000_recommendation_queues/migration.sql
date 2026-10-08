-- CreateEnum
CREATE TYPE "RecommendationSetStatus" AS ENUM ('OPEN', 'RESOLVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "TuningChangeStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "RecommendationSet" (
    "id" TEXT NOT NULL,
    "status" "RecommendationSetStatus" NOT NULL DEFAULT 'OPEN',
    "snapshot" JSONB NOT NULL,
    "modelIds" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecommendationSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TuningChange" (
    "id" TEXT NOT NULL,
    "setId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "baselineValue" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "appliedValue" TEXT,
    "rationale" TEXT NOT NULL,
    "status" "TuningChangeStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3),
    "appliedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TuningChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecommendationSet_status_createdAt_idx" ON "RecommendationSet"("status", "createdAt");

-- CreateIndex
CREATE INDEX "TuningChange_setId_status_idx" ON "TuningChange"("setId", "status");

-- CreateIndex
CREATE INDEX "TuningChange_setId_status_sortOrder_idx" ON "TuningChange"("setId", "status", "sortOrder");

-- AddForeignKey
ALTER TABLE "TuningChange" ADD CONSTRAINT "TuningChange_setId_fkey" FOREIGN KEY ("setId") REFERENCES "RecommendationSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;