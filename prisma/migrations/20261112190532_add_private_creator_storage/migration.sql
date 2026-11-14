-- CreateEnum
CREATE TYPE "StorageConnectionStatus" AS ENUM ('PENDING', 'VERIFIED', 'ERROR');

-- AlterTable
ALTER TABLE "Video" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "sizeBytes" BIGINT,
ADD COLUMN     "storageConnectionId" TEXT,
ADD COLUMN     "storageKey" TEXT;

-- CreateTable
CREATE TABLE "StorageConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'BACKBLAZE_B2',
    "region" TEXT NOT NULL,
    "bucketName" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "encryptedApplicationKey" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'viewers-tube',
    "status" "StorageConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorageConnection_userId_key" ON "StorageConnection"("userId");

-- CreateIndex
CREATE INDEX "StorageConnection_status_idx" ON "StorageConnection"("status");

-- CreateIndex
CREATE INDEX "Video_storageConnectionId_idx" ON "Video"("storageConnectionId");

-- AddForeignKey
ALTER TABLE "StorageConnection" ADD CONSTRAINT "StorageConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Video" ADD CONSTRAINT "Video_storageConnectionId_fkey" FOREIGN KEY ("storageConnectionId") REFERENCES "StorageConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
