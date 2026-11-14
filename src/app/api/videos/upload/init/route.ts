import { createB2Client } from "@/lib/b2-client";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


const TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const MAX_SIZE = 5 * 1024 * 1024 * 1024;

export async function POST(request: Request) {
  let client: S3Client | undefined;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, role: true, emailVerified: true,
        creatorAgreementAcceptedAt: true,
        creatorTerminatedAt: true, creatorSuspendedUntil: true,
        storageConnections: {
          where: { status: "VERIFIED" },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        },
        channel: true,
      },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json({ error: "Creator or Admin access required." }, { status: 403 });
    }

    if (user.role === "CREATOR" && (
      !user.emailVerified ||
      !user.creatorAgreementAcceptedAt ||
      user.creatorTerminatedAt ||
      (user.creatorSuspendedUntil && user.creatorSuspendedUntil > new Date())
    )) {
      return NextResponse.json({ error: "Your Creator account is not currently eligible to upload." }, { status: 403 });
    }

    const body = await request.json();
    const requestedConnectionId =
      typeof body.storageConnectionId === "string"
        ? body.storageConnectionId
        : null;

    const connection = requestedConnectionId
      ? user.storageConnections.find(item => item.id === requestedConnectionId)
      : user.storageConnections.find(item => item.isDefault) ?? user.storageConnections[0];

    if (!connection) {
      return NextResponse.json({
        error: requestedConnectionId
          ? "That storage connection does not belong to your account or is not verified."
          : "Connect and verify a Backblaze bucket first.",
      }, { status: 400 });
    }
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const language = typeof body.language === "string" ? body.language.trim() : "";
    const visibility = body.visibility;
    const scheduledAt = typeof body.scheduledAt === "string" && body.scheduledAt.trim()
      ? new Date(body.scheduledAt)
      : null;
    if (body.scheduledAt && (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date())) {
      return NextResponse.json({ error: "Choose a valid future publishing date and time." }, { status: 400 });
    }
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const isShort = body.isShort === true;
    const size = Number(body.size);

    if (!title || title.length > 180 || !description || description.length > 5000 ||
        category.length > 80 || language.length > 20 ||
        !["PUBLIC", "UNLISTED", "PRIVATE"].includes(visibility)) {
      return NextResponse.json({ error: "Enter a title, description (maximum 5,000 characters), valid category, language and visibility." }, { status: 400 });
    }
    if (!TYPES.has(contentType) || !Number.isSafeInteger(size) || size < 1 || size > MAX_SIZE) {
      return NextResponse.json({ error: "Use an MP4, WebM or MOV video no larger than 5 GB." }, { status: 400 });
    }

    let channel = user.channel;
    if (!channel && user.role === "ADMIN") {
      channel = await prisma.channel.create({
        data: {
          userId: user.id,
          name: "Viewers Tube Admin",
          slug: `admin-${user.id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-16)}`,
        },
      });
    }
    if (!channel) return NextResponse.json({ error: "Your channel is not ready." }, { status: 400 });

    client = createB2Client(connection);

    const video = await prisma.video.create({
      data: {
        channelId: channel.id,
        title,
        description,
        isShort,
        category: category || null,
        language: language || null,
        visibility: scheduledAt ? "PRIVATE" : visibility,
        scheduledAt,
        scheduledVisibility: scheduledAt ? visibility : null,
        contentType,
        sizeBytes: BigInt(size),
        storageConnectionId: connection.id,
        storageKey: `${connection.prefix ? connection.prefix + "/" : ""}${user.id}/${crypto.randomUUID()}`,
        status: "PROCESSING",
      },
      select: { id: true, storageKey: true },
    });

    const command = new PutObjectCommand({
      Bucket: connection.bucketName,
      Key: video.storageKey!,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 900 });

    return NextResponse.json({
      videoId: video.id,
      uploadUrl,
      requiredHeaders: { "Content-Type": contentType },
      expiresIn: 900,
    });
  } catch (error) {
    console.error("Video upload initialization failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not start the upload." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
