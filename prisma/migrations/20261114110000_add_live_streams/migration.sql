CREATE TYPE "LiveStreamVisibility" AS ENUM ('PUBLIC', 'PRIVATE');

CREATE TABLE "LiveStream" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "streamPath" TEXT NOT NULL,
    "streamKeyHash" TEXT NOT NULL,
    "visibility" "LiveStreamVisibility" NOT NULL DEFAULT 'PUBLIC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LiveStream_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LiveStream_streamPath_key" ON "LiveStream"("streamPath");
CREATE INDEX "LiveStream_channelId_enabled_createdAt_idx" ON "LiveStream"("channelId", "enabled", "createdAt");
CREATE INDEX "LiveStream_visibility_enabled_idx" ON "LiveStream"("visibility", "enabled");

ALTER TABLE "LiveStream"
ADD CONSTRAINT "LiveStream_channelId_fkey"
FOREIGN KEY ("channelId") REFERENCES "Channel"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
