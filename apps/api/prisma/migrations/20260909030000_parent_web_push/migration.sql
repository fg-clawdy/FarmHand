-- CreateEnum
CREATE TYPE "ApprovalSubjectKind" AS ENUM ('chore_claim', 'store_redemption');

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushActionToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "subjectKind" "ApprovalSubjectKind" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_adminId_idx" ON "PushSubscription"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "PushActionToken_tokenHash_key" ON "PushActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PushActionToken_subjectKind_subjectId_idx" ON "PushActionToken"("subjectKind", "subjectId");

-- CreateIndex
CREATE INDEX "PushActionToken_expiresAt_idx" ON "PushActionToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushActionToken_adminId_subjectKind_subjectId_key" ON "PushActionToken"("adminId", "subjectKind", "subjectId");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushActionToken" ADD CONSTRAINT "PushActionToken_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
