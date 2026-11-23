-- CreateEnum
CREATE TYPE "PromotionAccessStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PromotionCampaignStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'ACTIVE', 'PAUSED', 'REJECTED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromotionAdStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PromotionReviewTargetType" AS ENUM ('CAMPAIGN', 'AD');

-- CreateEnum
CREATE TYPE "PromotionReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FLAGGED');

-- CreateTable
CREATE TABLE "PromotionAccessRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PromotionAccessStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "reviewerNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionCampaign" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PromotionCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "budgetMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "creatorFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "reviveAdvertiserId" INTEGER,
    "reviveCampaignId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionAd" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'IMAGE',
    "creativeUrl" TEXT,
    "destinationUrl" TEXT,
    "altText" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "PromotionAdStatus" NOT NULL DEFAULT 'DRAFT',
    "reviveBannerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionAd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionPlacement" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" TEXT NOT NULL DEFAULT 'BANNER',
    "width" INTEGER,
    "height" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "revivePublisherId" INTEGER,
    "reviveZoneId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionReview" (
    "id" TEXT NOT NULL,
    "targetType" "PromotionReviewTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" "PromotionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campaignId" TEXT,
    "adId" TEXT,

    CONSTRAINT "PromotionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PromotionAccessRequest_userId_status_idx" ON "PromotionAccessRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "PromotionAccessRequest_status_createdAt_idx" ON "PromotionAccessRequest"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionCampaign_reviveAdvertiserId_key" ON "PromotionCampaign"("reviveAdvertiserId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionCampaign_reviveCampaignId_key" ON "PromotionCampaign"("reviveCampaignId");

-- CreateIndex
CREATE INDEX "PromotionCampaign_ownerId_status_createdAt_idx" ON "PromotionCampaign"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "PromotionCampaign_status_startsAt_endsAt_idx" ON "PromotionCampaign"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "PromotionCampaign_category_idx" ON "PromotionCampaign"("category");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionAd_reviveBannerId_key" ON "PromotionAd"("reviveBannerId");

-- CreateIndex
CREATE INDEX "PromotionAd_campaignId_status_idx" ON "PromotionAd"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionPlacement_reviveZoneId_key" ON "PromotionPlacement"("reviveZoneId");

-- CreateIndex
CREATE INDEX "PromotionPlacement_enabled_idx" ON "PromotionPlacement"("enabled");

-- CreateIndex
CREATE INDEX "PromotionReview_targetType_targetId_status_idx" ON "PromotionReview"("targetType", "targetId", "status");

-- CreateIndex
CREATE INDEX "PromotionReview_status_createdAt_idx" ON "PromotionReview"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PromotionReview_reviewerId_idx" ON "PromotionReview"("reviewerId");

-- AddForeignKey
ALTER TABLE "PromotionAccessRequest" ADD CONSTRAINT "PromotionAccessRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionAccessRequest" ADD CONSTRAINT "PromotionAccessRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionCampaign" ADD CONSTRAINT "PromotionCampaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionAd" ADD CONSTRAINT "PromotionAd_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionReview" ADD CONSTRAINT "PromotionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionReview" ADD CONSTRAINT "PromotionReview_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "PromotionCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionReview" ADD CONSTRAINT "PromotionReview_adId_fkey" FOREIGN KEY ("adId") REFERENCES "PromotionAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
