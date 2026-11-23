CREATE TYPE "CreatorApplicationStatus" AS ENUM (
  'NOT_APPLIED',
  'PENDING',
  'APPROVED',
  'REJECTED'
);

ALTER TABLE "User"
  ADD COLUMN "creatorApplicationStatus" "CreatorApplicationStatus"
    NOT NULL DEFAULT 'NOT_APPLIED',
  ADD COLUMN "creatorApplicationSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "creatorApplicationReviewedAt" TIMESTAMP(3),
  ADD COLUMN "creatorApplicationReviewedById" TEXT,
  ADD COLUMN "creatorApplicationReviewNote" TEXT;

UPDATE "User"
SET "creatorApplicationStatus" = 'APPROVED'
WHERE "role" = 'CREATOR';

CREATE INDEX "User_creatorApplicationStatus_creatorApplicationSubmittedAt_idx"
ON "User"("creatorApplicationStatus", "creatorApplicationSubmittedAt");
