import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createB2Client } from "@/lib/b2-client";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isSameOriginRequest } from "@/lib/request-origin";
import {
  recordPlatformIncident,
  withTransientRetry,
} from "@/lib/platform-incidents";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let incident: {
    id: string;
    source: string;
    targetId: string | null;
    title: string;
  } | null = null;

  let actor: { id: string; role: string } | null = null;

  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { error: "Request origin not allowed." },
        { status: 403 }
      );
    }

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
      select: { id: true, role: true },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json(
        { error: "Admin or Creator access required." },
        { status: 403 }
      );
    }

    actor = { id: user.id, role: user.role };

    const body = await request.json().catch(() => null) as
      | { incidentId?: unknown }
      | null;

    if (
      typeof body?.incidentId !== "string" ||
      !body.incidentId ||
      body.incidentId.length > 128
    ) {
      return NextResponse.json(
        { error: "A valid incident ID is required." },
        { status: 400 }
      );
    }

    incident = await prisma.platformIncident.findFirst({
      where: {
        id: body.incidentId,
        ...(user.role === "ADMIN" ? {} : { actorUserId: user.id }),
      },
      select: {
        id: true,
        source: true,
        targetId: true,
        title: true,
      },
    });

    if (!incident) {
      return NextResponse.json(
        { error: "Incident not found in your permitted scope." },
        { status: 404 }
      );
    }

    if (incident.source === "VIDEOS_LIBRARY") {
      await withTransientRetry(() =>
        prisma.video.findMany({
          where: { status: "READY", visibility: "PUBLIC" },
          take: 100,
          select: {
            id: true,
            storageConnection: { select: { status: true } },
            channel: {
              select: {
                owner: { select: { creatorTerminatedAt: true } },
              },
            },
          },
        }),
      );
    } else if (incident.source === "VIDEO_THUMBNAIL") {
      if (!incident.targetId) {
        throw new Error("Thumbnail incident has no video target.");
      }

      const video = await withTransientRetry(() =>
        prisma.video.findUnique({
          where: { id: incident!.targetId! },
          include: {
            storageConnection: true,
            channel: {
              select: { owner: { select: { id: true } } },
            },
          },
        }),
      );

      if (
        !video ||
        video.status !== "READY" ||
        !video.storageConnection ||
        !video.storageKey
      ) {
        throw new Error("Video or thumbnail storage is not ready.");
      }

      if (
        user.role === "CREATOR" &&
        video.channel.owner.id !== user.id
      ) {
        return NextResponse.json(
          { error: "This video is outside your permitted scope." },
          { status: 404 }
        );
      }

      if (video.storageConnection.status !== "VERIFIED") {
        throw new Error("Storage connection needs verification first.");
      }

      let client: S3Client | undefined;
      try {
        client = createB2Client(video.storageConnection);
        await getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: video.storageConnection.bucketName,
            Key: `${video.storageKey}.hls/thumbnail.jpg`,
          }),
          { expiresIn: 300 },
        );
      } finally {
        client?.destroy();
      }
    } else {
      await withTransientRetry(() => prisma.$queryRaw`SELECT 1`);
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.platformIncident.updateMany({
        where: { id: incident.id, status: "OPEN" },
        data: { status: "RESOLVED", resolvedAt: now },
      }),
      prisma.repairAuditEvent.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "VERIFY_PLATFORM_INCIDENT",
          status: "RESOLVED",
          targetType: incident.source,
          targetId: incident.targetId,
          summary: `Incident verification passed: ${incident.title}.`,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "Verification passed. The incident has been marked resolved.",
    });
  } catch (error) {
    console.error("[repair-centre] Incident verification failed:", error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : String(error));

    if (incident) {
      try {
        await recordPlatformIncident({
          source: incident.source,
          title: incident.title,
          detail: "Manual verification did not pass; the incident remains open.",
          error,
          targetId: incident.targetId,
          actorUserId: actor?.id ?? null,
        });
      } catch (recordError) {
        console.error("[repair-centre] Failed to record verification incident:", recordError);
      }
    }

    return NextResponse.json(
      {
        error: "Verification failed. The incident remains open. Check the diagnosed service and try again.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
