-- CreateEnum
CREATE TYPE "PodcastStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PodcastVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "PodcastEpisodeStatus" AS ENUM ('UPLOADING', 'READY', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "Podcast" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "artworkUrl" TEXT,
    "category" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "explicit" BOOLEAN NOT NULL DEFAULT false,
    "visibility" "PodcastVisibility" NOT NULL DEFAULT 'PUBLIC',
    "status" "PodcastStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Podcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastEpisode" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "storageConnectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "durationSeconds" INTEGER,
    "seasonNumber" INTEGER,
    "episodeNumber" INTEGER,
    "status" "PodcastEpisodeStatus" NOT NULL DEFAULT 'UPLOADING',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodcastEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Podcast_slug_key" ON "Podcast"("slug");

-- CreateIndex
CREATE INDEX "Podcast_channelId_status_idx" ON "Podcast"("channelId", "status");

-- CreateIndex
CREATE INDEX "Podcast_visibility_status_idx" ON "Podcast"("visibility", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PodcastEpisode_storageKey_key" ON "PodcastEpisode"("storageKey");

-- CreateIndex
CREATE INDEX "PodcastEpisode_podcastId_status_publishedAt_idx" ON "PodcastEpisode"("podcastId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "PodcastEpisode_storageConnectionId_idx" ON "PodcastEpisode"("storageConnectionId");

-- AddForeignKey
ALTER TABLE "Podcast" ADD CONSTRAINT "Podcast_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisode" ADD CONSTRAINT "PodcastEpisode_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastEpisode" ADD CONSTRAINT "PodcastEpisode_storageConnectionId_fkey" FOREIGN KEY ("storageConnectionId") REFERENCES "StorageConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
