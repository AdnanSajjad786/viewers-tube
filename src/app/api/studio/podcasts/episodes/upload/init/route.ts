import { createB2Client } from "@/lib/b2-client";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isEligibleStudioUserById } from "@/lib/creator-access";
import { prisma } from "@/lib/prisma";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const TYPES: Record<string, string> = {
  "audio/mpeg": "audio", "audio/mp4": "audio", "audio/aac": "audio",
  "audio/wav": "audio", "audio/x-wav": "audio", "audio/ogg": "audio",
  "audio/flac": "audio", "audio/webm": "audio",
  "video/mp4": "video", "video/webm": "video", "video/quicktime": "video",
};
const MAX_SIZE = 5 * 1024 * 1024 * 1024;

export async function POST(request: Request) {
  let client: ReturnType<typeof createB2Client> | undefined;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && !(await isEligibleStudioUserById(session.user.id))) {
      return NextResponse.json({ error: "Creator account is not eligible." }, { status: 403 });
    }
    if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, role: true, emailVerified: true,
        creatorAgreementAcceptedAt: true, creatorTerminatedAt: true,
        creatorSuspendedUntil: true,
        storageConnections: {
          where: { status: "VERIFIED" },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role))
      return NextResponse.json({ error: "Creator or Admin access required." }, { status: 403 });

    if (user.role === "CREATOR" && (
      !user.emailVerified || !user.creatorAgreementAcceptedAt ||
      user.creatorTerminatedAt ||
      (user.creatorSuspendedUntil && user.creatorSuspendedUntil > new Date())
    )) return NextResponse.json({ error: "Your Creator account is not eligible to upload." }, { status: 403 });

    const body = await request.json();
    const podcastId = typeof body.podcastId === "string" ? body.podcastId : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = Number(body.size);
    const duration = Number(body.durationSeconds);

    if (!podcastId || !title || title.length > 180 || description.length > 5000)
      return NextResponse.json({ error: "Enter a valid episode title and podcast." }, { status: 400 });
    if (!TYPES[contentType] || !Number.isSafeInteger(size) || size < 1 || size > MAX_SIZE)
      return NextResponse.json({ error: "Unsupported audio/video format or file exceeds 5 GB." }, { status: 400 });

    const podcast = await prisma.podcast.findFirst({
      where: { id: podcastId, channel: { owner: { id: user.id } } },
      select: { id: true },
    });
    if (!podcast) return NextResponse.json({ error: "Podcast not found or access denied." }, { status: 404 });

    const connection = user.storageConnections[0];
    if (!connection) return NextResponse.json({ error: "Connect and verify a Backblaze storage bucket first." }, { status: 400 });

    const storageKey = `${connection.prefix ? connection.prefix + "/" : ""}${user.id}/podcasts/${crypto.randomUUID()}`;
    const episode = await prisma.podcastEpisode.create({
      data: {
        podcastId, storageConnectionId: connection.id, title,
        description: description || null, storageKey, contentType,
        sizeBytes: BigInt(size),
        durationSeconds: Number.isSafeInteger(duration) && duration > 0 && duration < 86400 ? duration : null,
        status: "UPLOADING",
      },
      select: { id: true, storageKey: true },
    });

    client = createB2Client(connection);
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({
      Bucket: connection.bucketName, Key: storageKey, ContentType: contentType,
    }), { expiresIn: 900 });

    return NextResponse.json({
      episodeId: episode.id, uploadUrl,
      requiredHeaders: { "Content-Type": contentType },
      expiresIn: 900, mediaType: TYPES[contentType],
    });
  } catch (error) {
    console.error("Podcast episode upload initialization failed:", error);
    return NextResponse.json({ error: "Could not start episode upload." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
