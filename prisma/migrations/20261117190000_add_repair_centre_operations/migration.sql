CREATE TABLE "RepairAuditEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RepairAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RepairAuditEvent_actorUserId_createdAt_idx"
ON "RepairAuditEvent"("actorUserId", "createdAt");

CREATE INDEX "RepairAuditEvent_createdAt_idx"
ON "RepairAuditEvent"("createdAt");

CREATE INDEX "RepairAuditEvent_targetType_targetId_idx"
ON "RepairAuditEvent"("targetType", "targetId");

CREATE TABLE "WorkerHeartbeat" (
    "id" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkerHeartbeat_pkey" PRIMARY KEY ("id")
);
