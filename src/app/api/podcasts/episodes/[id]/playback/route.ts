import { createB2Client } from "@/lib/b2-client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let client: ReturnType<typeof createB2Client> | undefined;
  try {
    const { id } = await context.params;
    const episode = await prisma.podcastEpisode.findFirst({
      where: {
        id,
        status: "PUBLISHED",
        podcast: { status: "PUBLISHED", visibility: "PUBLIC" },
        storageConnection: { status: "VERIFIED" },
      },
      include: { storageConnection: true },
    });

    if (!episode) {
      return NextResponse.json({ error: "Episode is unavailable." }, { status: 404 });
    }

    const connection = episode.storageConnection;
    client = createB2Client(connection);
    const url = await getSignedUrl(client, new GetObjectCommand({
      Bucket: connection.bucketName,
      Key: episode.storageKey,
      ResponseContentType: episode.contentType,
      ResponseContentDisposition: "inline",
    }), { expiresIn: 300 });

    return NextResponse.json({
      url,
      expiresIn: 300,
      contentType: episode.contentType,
      title: episode.title,
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Public podcast playback failed:", error);
    return NextResponse.json({ error: "Could not prepare playback." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
