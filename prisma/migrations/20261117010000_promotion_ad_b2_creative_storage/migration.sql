ALTER TABLE "PromotionAd"
  ADD COLUMN "creativeStorageConnectionId" TEXT,
  ADD COLUMN "creativeStorageKey" TEXT;

CREATE TABLE "PromotionCreativeUpload" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "storageConnectionId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UPLOADING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromotionCreativeUpload_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionCreativeUpload_userId_status_idx"
  ON "PromotionCreativeUpload"("userId", "status");

CREATE INDEX "PromotionCreativeUpload_storageConnectionId_storageKey_idx"
  ON "PromotionCreativeUpload"("storageConnectionId", "storageKey");
