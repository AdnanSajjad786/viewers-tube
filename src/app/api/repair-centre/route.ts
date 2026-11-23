import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in required." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, displayName: true },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json(
        { error: "Admin or Creator access required." },
        { status: 403 }
      );
    }

    // Every Creator query is restricted to content owned by their channel.
    const videoWhere = user.role === "ADMIN"
      ? {}
      : { channel: { owner: { id: user.id } } };

    const jobWhere = user.role === "ADMIN"
      ? {}
      : { video: { channel: { owner: { id: user.id } } } };

    const episodeWhere = user.role === "ADMIN"
      ? {}
      : { podcast: { channel: { owner: { id: user.id } } } };

    const storageWhere = user.role === "ADMIN"
      ? {}
      : { userId: user.id };

    // A successful query is the database connectivity check.
    await prisma.$queryRaw`SELECT 1`;

    const [
      totalVideos,
      failedVideos,
      processingVideos,
      failedJobs,
      pendingJobs,
      runningJobs,
      failedEpisodes,
      uploadingEpisodes,
      totalEpisodes,
      totalStorage,
      storageErrors,
      storageConnections,
      recentFailures,
      heartbeat,
      recentHistory,
    ] = await Promise.all([
      prisma.video.count({ where: videoWhere }),
      prisma.video.count({ where: { ...videoWhere, status: "FAILED" } }),
      prisma.video.count({ where: { ...videoWhere, status: "PROCESSING" } }),
      prisma.transcodeJob.count({ where: { ...jobWhere, status: "FAILED" } }),
      prisma.transcodeJob.count({ where: { ...jobWhere, status: "PENDING" } }),
      prisma.transcodeJob.count({ where: { ...jobWhere, status: "RUNNING" } }),
      prisma.podcastEpisode.count({ where: { ...episodeWhere, status: "FAILED" } }),
      prisma.podcastEpisode.count({ where: { ...episodeWhere, status: "UPLOADING" } }),
      prisma.podcastEpisode.count({ where: episodeWhere }),
      prisma.storageConnection.count({ where: storageWhere }),
      prisma.storageConnection.count({
        where: { ...storageWhere, status: "ERROR" },
      }),
      prisma.storageConnection.findMany({
        where: storageWhere,
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          label: true,
          region: true,
          bucketName: true,
          prefix: true,
          status: true,
          verifiedAt: true,
        },
      }),
      prisma.transcodeJob.findMany({
        where: { ...jobWhere, status: "FAILED" },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          attempts: true,
          updatedAt: true,
          video: { select: { title: true } },
        },
      }),
      prisma.workerHeartbeat.findUnique({
        where: { id: "transcode-worker" },
        select: { lastSeenAt: true },
      }),
      prisma.repairAuditEvent.findMany({
        where: user.role === "ADMIN" ? {} : { actorUserId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          actorRole: true,
          action: true,
          status: true,
          targetType: true,
          summary: true,
          createdAt: true,
        },
      }),
    ]);


    const incidents = await prisma.platformIncident.findMany({
      where: user.role === "ADMIN" ? {} : { actorUserId: user.id },
      orderBy: { lastSeenAt: "desc" },
      take: 30,
      select: {
        id: true,
        source: true,
        severity: true,
        status: true,
        title: true,
        detail: true,
        errorCode: true,
        targetId: true,
        occurrences: true,
        firstSeenAt: true,
        lastSeenAt: true,
        resolvedAt: true,
      },
    });

    const heartbeatAge = heartbeat
      ? Date.now() - heartbeat.lastSeenAt.getTime()
      : null;
    const workerStatus =
      heartbeatAge === null ? "unknown"
      : heartbeatAge <= 45_000 ? "healthy"
      : heartbeatAge <= 120_000 ? "warning"
      : "error";

    const issues = [];

    if (failedVideos > 0) {
      issues.push({
        severity: "warning",
        title: "Failed video processing",
        detail: `${failedVideos} video(s) have failed processing.`,
      });
    }

    if (failedJobs > 0) {
      issues.push({
        severity: "warning",
        title: "Failed transcoding jobs",
        detail: `${failedJobs} transcoding job(s) require investigation.`,
      });
    }

    if (failedEpisodes > 0) {
      issues.push({
        severity: "warning",
        title: "Failed podcast episodes",
        detail: `${failedEpisodes} podcast episode(s) have failed.`,
      });
    }

    if (storageErrors > 0) {
      issues.push({
        severity: "warning",
        title: "Storage connection errors",
        detail: `${storageErrors} storage connection(s) report an error.`,
      });
    }

    if (pendingJobs > 0) {
      issues.push({
        severity: "info",
        title: "Queued transcoding jobs",
        detail: `${pendingJobs} job(s) are waiting for the worker.`,
      });
    }

    if (runningJobs > 0) {
      issues.push({
        severity: "info",
        title: "Transcoding in progress",
        detail: `${runningJobs} job(s) are currently marked as running.`,
      });
    }

    if (workerStatus !== "healthy") {
      issues.push({
        severity: workerStatus === "unknown" ? "warning" : "warning",
        title: "Processing worker heartbeat",
        detail: workerStatus === "unknown"
          ? "No worker heartbeat has been recorded yet."
          : `The last worker heartbeat was ${Math.round((heartbeatAge ?? 0) / 1000)} seconds ago.`,
      });
    }

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      scope: user.role === "ADMIN" ? "system" : "personal",
      role: user.role,
      displayName: user.displayName,
      checks: {
        database: { status: "healthy", label: "Database connection" },
        authentication: { status: "healthy", label: "Authenticated session" },
        worker: {
          status: workerStatus,
          label: "Processing worker heartbeat",
          detail: heartbeat
            ? `Last heartbeat: ${heartbeat.lastSeenAt.toISOString()}`
            : "No heartbeat record exists yet.",
        },
      },
      storageConnections: storageConnections.map((connection) => ({
        ...connection,
        verifiedAt: connection.verifiedAt?.toISOString() ?? null,
      })),
      metrics: {
        totalVideos,
        failedVideos,
        processingVideos,
        failedJobs,
        pendingJobs,
        runningJobs,
        totalEpisodes,
        failedEpisodes,
        uploadingEpisodes,
        totalStorage,
        storageErrors,
      },
      issues,
      incidents: incidents.map((incident) => ({
        ...incident,
        firstSeenAt: incident.firstSeenAt.toISOString(),
        lastSeenAt: incident.lastSeenAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      })),
      recentFailures: recentFailures.map((job) => ({
        id: job.id,
        title: job.video.title,
        attempts: job.attempts,
        updatedAt: job.updatedAt.toISOString(),
        // Stored error text is intentionally not exposed.
      })),
      recentHistory: recentHistory.map((event) => ({
        id: event.id,
        actorRole: event.actorRole,
        action: event.action,
        status: event.status,
        targetType: event.targetType,
        summary: event.summary,
        createdAt: event.createdAt.toISOString(),
      })),
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    console.error("[repair-centre] Diagnostic request failed.");
    return NextResponse.json(
      {
        error: "Diagnostics could not complete. Check database connectivity and server logs.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
