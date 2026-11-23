import { createB2Client } from "@/lib/b2-client";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isEligibleStudioUserById } from "@/lib/creator-access";
import { prisma } from "@/lib/prisma";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  let client: ReturnType<typeof createB2Client> | undefined;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && !(await isEligibleStudioUserById(session.user.id))) {
      return NextResponse.json({ error: "Creator account is not eligible." }, { status: 403 });
    }
    if (!session) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const { id } = await context.params;
    const episode = await prisma.podcastEpisode.findUnique({
      where: { id },
      include: {
        storageConnection: true,
        podcast: { include: { channel: { include: { owner: { select: { id: true } } } } } },
      },
    });

    if (!episode || !["READY", "PUBLISHED"].includes(episode.status)) {
      return NextResponse.json({ error: "Episode is unavailable." }, { status: 404 });
    }

    const isOwner = episode.podcast.channel.owner.id === session.user.id;
    const isAdmin = await prisma.user.findFirst({
      where: { id: session.user.id, role: "ADMIN" },
      select: { id: true },
    });

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const connection = episode.storageConnection;
    if (connection.status !== "VERIFIED") {
      return NextResponse.json({ error: "Episode storage is unavailable." }, { status: 503 });
    }

    client = createB2Client(connection);
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: connection.bucketName,
        Key: episode.storageKey,
        ResponseContentType: episode.contentType,
        ResponseContentDisposition: "inline",
      }),
      { expiresIn: 300 }
    );

    return NextResponse.json({
      url,
      expiresIn: 300,
      contentType: episode.contentType,
      title: episode.title,
    });
  } catch (error) {
    console.error("Podcast playback preparation failed:", error);
    return NextResponse.json({ error: "Could not prepare episode playback." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
