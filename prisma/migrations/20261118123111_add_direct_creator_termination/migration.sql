-- CreateEnum
CREATE TYPE "CreatorTerminationAppealStatus" AS ENUM ('NOT_APPEALED', 'OPEN', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "CreatorTermination" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceReference" TEXT,
    "status" "CreatorTerminationAppealStatus" NOT NULL DEFAULT 'NOT_APPEALED',
    "terminatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appealedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewerId" TEXT,
    "reviewerNote" TEXT,
    "notificationSentAt" TIMESTAMP(3),

    CONSTRAINT "CreatorTermination_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorTermination_userId_terminatedAt_idx" ON "CreatorTermination"("userId", "terminatedAt");

-- CreateIndex
CREATE INDEX "CreatorTermination_status_terminatedAt_idx" ON "CreatorTermination"("status", "terminatedAt");

-- AddForeignKey
ALTER TABLE "CreatorTermination" ADD CONSTRAINT "CreatorTermination_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
