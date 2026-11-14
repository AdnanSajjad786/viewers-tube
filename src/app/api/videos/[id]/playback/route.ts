import { createB2Client } from "@/lib/b2-client";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";


export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let client: S3Client | undefined;

  try {
    const { id } = await context.params;
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        storageConnection: true,
        renditions: { orderBy: { height: "asc" } },
        transcodeJob: { select: { status: true } },
        channel: { include: { owner: { select: { id: true, role: true } } } },
      },
    });

    if (!video || video.status !== "READY" || !video.storageConnection || !video.storageKey) {
      return NextResponse.json({ error: "Video is unavailable." }, { status: 404 });
    }

    const session = await auth.api.getSession({ headers: await headers() });
    const isOwner = session?.user.id === video.channel.owner.id;
    const isAdmin = session && await prisma.user.findFirst({
      where: { id: session.user.id, role: "ADMIN" },
      select: { id: true },
    });

    if (
      (video.visibility === "PRIVATE" ||
        (video.scheduledAt !== null && video.scheduledAt > new Date())) &&
      !isOwner &&
      !isAdmin
    ) {
      return NextResponse.json({ error: "Video is private." }, { status: 403 });
    }

    if (video.channel.owner.role === "CREATOR") {
      const owner = await prisma.user.findUnique({
        where: { id: video.channel.owner.id },
        select: { creatorTerminatedAt: true },
      });
      if (owner?.creatorTerminatedAt) {
        return NextResponse.json({ error: "Video is unavailable." }, { status: 404 });
      }
    }

    const connection = video.storageConnection;
    if (connection.status !== "VERIFIED") {
      return NextResponse.json({ error: "Storage is unavailable." }, { status: 503 });
    }

    client = createB2Client(connection);

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: connection.bucketName,
        Key: video.storageKey,
      }),
      { expiresIn: 120 }
    );

    const adaptiveReady =
      video.transcodeJob?.status === "COMPLETED" &&
      video.renditions.length > 0;

    return NextResponse.json({
      url,
      expiresIn: 120,
      hlsUrl: adaptiveReady
        ? `/api/videos/${encodeURIComponent(video.id)}/hls/master`
        : null,
      qualities: adaptiveReady
        ? video.renditions.map((item) => ({
            height: item.height,
            width: item.width,
            bandwidth: item.bandwidth,
          }))
        : [],
    });
  } catch (error) {
    console.error("Video playback URL failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not prepare video playback." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
