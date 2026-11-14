-- CreateEnum
CREATE TYPE "TranscodeJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- DropIndex
DROP INDEX "StorageConnection_userId_key";

-- AlterTable
ALTER TABLE "StorageConnection" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "label" TEXT;

-- CreateTable
CREATE TABLE "TranscodeJob" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "status" "TranscodeJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscodeJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoRendition" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "height" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "bandwidth" INTEGER NOT NULL,
    "playlistKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoRendition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranscodeJob_videoId_key" ON "TranscodeJob"("videoId");

-- CreateIndex
CREATE INDEX "TranscodeJob_status_createdAt_idx" ON "TranscodeJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "VideoRendition_videoId_idx" ON "VideoRendition"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoRendition_videoId_height_key" ON "VideoRendition"("videoId", "height");

-- CreateIndex
CREATE INDEX "StorageConnection_userId_status_idx" ON "StorageConnection"("userId", "status");

-- CreateIndex
CREATE INDEX "StorageConnection_userId_isDefault_idx" ON "StorageConnection"("userId", "isDefault");

-- AddForeignKey
ALTER TABLE "TranscodeJob" ADD CONSTRAINT "TranscodeJob_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoRendition" ADD CONSTRAINT "VideoRendition_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
