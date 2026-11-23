import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

class RetryConflictError extends Error {}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Request origin not allowed." }, { status: 403 });
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json({ error: "Admin or Creator access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as { jobId?: unknown } | null;
    if (typeof body?.jobId !== "string" || body.jobId.length < 1 || body.jobId.length > 128) {
      return NextResponse.json({ error: "A valid job ID is required." }, { status: 400 });
    }

    const job = await prisma.transcodeJob.findUnique({
      where: { id: body.jobId },
      select: {
        id: true,
        status: true,
        attempts: true,
        updatedAt: true,
        video: {
          select: {
            id: true,
            status: true,
            channel: {
              select: { owner: { select: { id: true } } },
            },
          },
        },
      },
    });

    // Do not reveal whether another Creator owns a job.
    if (!job || (user.role === "CREATOR" && job.video.channel.owner.id !== user.id)) {
      return NextResponse.json({ error: "Failed job not found in your permitted scope." }, { status: 404 });
    }

    if (job.status !== "FAILED" || job.video.status !== "FAILED") {
      return NextResponse.json({ error: "Only failed video jobs can be retried." }, { status: 409 });
    }

    const maxAttempts = 3;
    if (job.attempts >= maxAttempts) {
      return NextResponse.json({ error: "This job reached the maximum of three attempts. Administrator investigation is required." }, { status: 409 });
    }

    const cooldownMs = 30_000;
    const elapsedMs = Date.now() - job.updatedAt.getTime();
    if (elapsedMs < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      return NextResponse.json(
        { error: `Please wait ${waitSeconds} seconds before retrying this job.` },
        { status: 429, headers: { "Retry-After": String(waitSeconds), "Cache-Control": "no-store" } }
      );
    }

    const queued = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.transcodeJob.updateMany({
        where: {
          id: job.id,
          status: "FAILED",
          attempts: { lt: maxAttempts },
          updatedAt: job.updatedAt,
        },
        data: { status: "PENDING", error: null },
      });

      if (updatedJob.count !== 1) return false;

      const updatedVideo = await tx.video.updateMany({
        where: { id: job.video.id, status: "FAILED" },
        data: { status: "PROCESSING" },
      });

      if (updatedVideo.count !== 1) {
        throw new RetryConflictError("Video state changed during retry.");
      }

      await tx.repairAuditEvent.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "RETRY_VIDEO",
          status: "QUEUED",
          targetType: "VIDEO",
          targetId: job.video.id,
          summary: "Video transcode retry successfully queued.",
        },
      });

      return true;
    });

    if (!queued) {
      return NextResponse.json(
        { error: "This job has already changed or another request queued it." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Retry queued. The background worker will process this video.",
      },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof RetryConflictError) {
      return NextResponse.json(
        { error: "The video state changed. Run diagnostics and try again if it is still failed." },
        { status: 409 }
      );
    }

    console.error("[repair-centre] Video retry action failed.");
    return NextResponse.json(
      { error: "The retry could not be queued. Check database connectivity and try again." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
