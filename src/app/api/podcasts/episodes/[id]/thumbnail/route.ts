import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { createB2Client } from "@/lib/b2-client";
import { prisma } from "@/lib/prisma";

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
        thumbnailUrl: { not: null },
        podcast: { status: "PUBLISHED", visibility: "PUBLIC" },
        storageConnection: { status: "VERIFIED" },
      },
      select: {
        storageKey: true,
        storageConnection: true,
      },
    });

    if (!episode) {
      return new NextResponse("Thumbnail not found.", { status: 404 });
    }

    const connection = episode.storageConnection;
    client = createB2Client(connection);

    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: connection.bucketName,
        Key: `${episode.storageKey}.hls/thumbnail.jpg`,
      }),
      { expiresIn: 300 }
    );

    return NextResponse.redirect(url, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (error) {
    console.error("Podcast thumbnail request failed:", error);
    return new NextResponse("Could not load thumbnail.", { status: 500 });
  } finally {
    client?.destroy();
  }
}
