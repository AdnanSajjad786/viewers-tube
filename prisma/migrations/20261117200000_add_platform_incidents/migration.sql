CREATE TABLE "PlatformIncident" (
    "id" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'ERROR',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "errorCode" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "actorUserId" TEXT,
    "occurrences" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlatformIncident_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformIncident_fingerprint_key"
ON "PlatformIncident"("fingerprint");

CREATE INDEX "PlatformIncident_status_lastSeenAt_idx"
ON "PlatformIncident"("status", "lastSeenAt");

CREATE INDEX "PlatformIncident_targetType_targetId_idx"
ON "PlatformIncident"("targetType", "targetId");

CREATE INDEX "PlatformIncident_actorUserId_lastSeenAt_idx"
ON "PlatformIncident"("actorUserId", "lastSeenAt");
