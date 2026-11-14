import { createB2Client } from "@/lib/b2-client";
import { NextResponse } from "next/server";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { prisma } from "@/lib/prisma";
import { getPlayableVideo } from "@/lib/video-playback-access";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let client: S3Client | undefined;

  try {
    const { id } = await context.params;
    const height = Number(new URL(request.url).searchParams.get("height"));

    if (!Number.isInteger(height) || height < 1 || height > 4320) {
      return NextResponse.json({ error: "Invalid video quality." }, { status: 400 });
    }

    const video = await getPlayableVideo(id);
    if (!video) {
      return NextResponse.json({ error: "Video is unavailable." }, { status: 404 });
    }

    const rendition = await prisma.videoRendition.findUnique({
      where: { videoId_height: { videoId: id, height } },
    });

    if (!rendition) {
      return NextResponse.json({ error: "This quality is unavailable." }, { status: 404 });
    }

    const connection = video.storageConnection;
    if (!connection) {
      return NextResponse.json({ error: "Storage unavailable." }, { status: 503 });
    }

    client = createB2Client(connection);

    const result = await client.send(new GetObjectCommand({
      Bucket: connection.bucketName,
      Key: rendition.playlistKey,
    }));

    if (!result.Body) {
      return NextResponse.json({ error: "Playlist is unavailable." }, { status: 404 });
    }

    const playlist = await result.Body.transformToString();
    const baseKey = rendition.playlistKey.slice(
      0,
      rendition.playlistKey.lastIndexOf("/") + 1
    );

    const rewritten: string[] = [];

    for (const line of playlist.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        rewritten.push(line);
        continue;
      }

      // This worker emits simple, relative MPEG-TS segment filenames only.
      if (!/^[A-Za-z0-9._-]+\.ts$/.test(trimmed)) {
        return NextResponse.json({ error: "Invalid HLS segment reference." }, { status: 502 });
      }

      const segmentUrl = await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: connection.bucketName,
          Key: `${baseKey}${trimmed}`,
        }),
        { expiresIn: 3600 }
      );

      rewritten.push(segmentUrl);
    }

    return new Response(rewritten.join("\n") + "\n", {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("HLS variant playlist failed:", error);
    return NextResponse.json({ error: "Could not load adaptive video segments." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
