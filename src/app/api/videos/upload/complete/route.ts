import { createB2Client } from "@/lib/b2-client";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";


export async function POST(request: Request) {
  let client: S3Client | undefined;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const { videoId } = await request.json();
    if (typeof videoId !== "string" || videoId.length > 100) {
      return NextResponse.json({ error: "Invalid video ID." }, { status: 400 });
    }

    const video = await prisma.video.findFirst({
      where: {
        id: videoId,
        channel: { owner: { id: session.user.id } },
        status: "PROCESSING",
      },
      include: { storageConnection: true },
    });

    if (!video || !video.storageConnection || !video.storageKey) {
      return NextResponse.json({ error: "Upload record not found." }, { status: 404 });
    }

    const connection = video.storageConnection;
    client = createB2Client(connection);

    const result = await client.send(new HeadObjectCommand({
      Bucket: connection.bucketName,
      Key: video.storageKey,
    }));

    if (
      !result.ContentLength ||
      BigInt(result.ContentLength) !== video.sizeBytes ||
      result.ContentType !== video.contentType
    ) {
      await prisma.video.update({
        where: { id: video.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json({ error: "Uploaded file size or type did not match the upload request." }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Keep the video PROCESSING until the worker finishes all renditions.

      // Queue once; retries must not overwrite an existing job.
      await tx.transcodeJob.createMany({
        data: [{ videoId: video.id, status: "PENDING" }],
        skipDuplicates: true,
      });
    });

    return NextResponse.json({ success: true, videoId: video.id });
  } catch (error) {
    console.error("Video upload completion failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Could not verify the uploaded video." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
