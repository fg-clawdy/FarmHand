-- AlterTable
ALTER TABLE "PushSubscription" ADD COLUMN "silentClearAts" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "PushDelivery" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "kind" "ApprovalSubjectKind" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deferredAt" TIMESTAMP(3),
    "clearedAt" TIMESTAMP(3),

    CONSTRAINT "PushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushDelivery_subscriptionId_tag_key" ON "PushDelivery"("subscriptionId", "tag");

-- CreateIndex
CREATE INDEX "PushDelivery_tag_clearedAt_deferredAt_idx" ON "PushDelivery"("tag", "clearedAt", "deferredAt");

-- CreateIndex
CREATE INDEX "PushDelivery_subscriptionId_deferredAt_clearedAt_idx" ON "PushDelivery"("subscriptionId", "deferredAt", "clearedAt");

-- AddForeignKey
ALTER TABLE "PushDelivery" ADD CONSTRAINT "PushDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "PushSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
