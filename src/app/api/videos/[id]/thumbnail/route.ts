import { createB2Client } from "@/lib/b2-client";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
        channel: { include: { owner: { select: { id: true, role: true } } } },
      },
    });

    if (
      !video ||
      video.status !== "READY" ||
      !video.storageConnection ||
      !video.storageKey
    ) {
      return NextResponse.json({ error: "Thumbnail unavailable." }, { status: 404 });
    }

    if (video.channel.owner.role === "CREATOR") {
      const owner = await prisma.user.findUnique({
        where: { id: video.channel.owner.id },
        select: { creatorTerminatedAt: true },
      });
      if (owner?.creatorTerminatedAt) {
        return NextResponse.json({ error: "Thumbnail unavailable." }, { status: 404 });
      }
    }

    const session = await auth.api.getSession({ headers: await headers() });
    const isOwner = session?.user.id === video.channel.owner.id;
    const isAdmin = session
      ? await prisma.user.findFirst({
          where: { id: session.user.id, role: "ADMIN" },
          select: { id: true },
        })
      : null;

    if (video.visibility === "PRIVATE" && !isOwner && !isAdmin) {
      return NextResponse.json({ error: "Thumbnail is private." }, { status: 403 });
    }

    const connection = video.storageConnection;
    if (connection.status !== "VERIFIED") {
      return NextResponse.json({ error: "Storage unavailable." }, { status: 503 });
    }

    client = createB2Client(connection);
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: connection.bucketName,
        Key: `${video.storageKey}.hls/thumbnail.jpg`,
      }),
      { expiresIn: 300 }
    );

    return NextResponse.redirect(url, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error(
      "Video thumbnail failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json({ error: "Could not load thumbnail." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
