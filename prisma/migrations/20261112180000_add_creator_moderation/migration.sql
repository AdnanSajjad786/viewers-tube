CREATE TYPE "StrikeStatus" AS ENUM ('ACTIVE', 'REVERSED');
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'APPROVED', 'REJECTED', 'WITHDRAWN');

ALTER TABLE "User"
ADD COLUMN "creatorAgreementVersion" TEXT,
ADD COLUMN "creatorAgreementAcceptedAt" TIMESTAMP(3),
ADD COLUMN "creatorSuspendedUntil" TIMESTAMP(3),
ADD COLUMN "creatorTerminatedAt" TIMESTAMP(3);

ALTER TABLE "Video"
ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "removalReason" TEXT;

CREATE TABLE "ModerationStrike" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "videoId" TEXT,
  "strikeNumber" INTEGER NOT NULL,
  "policyCode" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "suspensionDays" INTEGER NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "suspensionEndsAt" TIMESTAMP(3),
  "status" "StrikeStatus" NOT NULL DEFAULT 'ACTIVE',
  "notificationSentAt" TIMESTAMP(3),
  CONSTRAINT "ModerationStrike_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationAppeal" (
  "id" TEXT NOT NULL,
  "strikeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "reviewerNote" TEXT,
  CONSTRAINT "ModerationAppeal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModerationAppeal_strikeId_key" ON "ModerationAppeal"("strikeId");
CREATE INDEX "ModerationStrike_userId_status_issuedAt_idx" ON "ModerationStrike"("userId", "status", "issuedAt");
CREATE INDEX "ModerationStrike_videoId_idx" ON "ModerationStrike"("videoId");
CREATE INDEX "ModerationAppeal_userId_status_idx" ON "ModerationAppeal"("userId", "status");

ALTER TABLE "ModerationStrike"
ADD CONSTRAINT "ModerationStrike_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModerationStrike"
ADD CONSTRAINT "ModerationStrike_videoId_fkey"
FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ModerationAppeal"
ADD CONSTRAINT "ModerationAppeal_strikeId_fkey"
FOREIGN KEY ("strikeId") REFERENCES "ModerationStrike"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ModerationAppeal"
ADD CONSTRAINT "ModerationAppeal_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
