import { createB2Client } from "@/lib/b2-client";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isEligibleStudioUserById } from "@/lib/creator-access";
import { prisma } from "@/lib/prisma";
import { HeadObjectCommand } from "@aws-sdk/client-s3";

export async function POST(request: Request) {
  let client: ReturnType<typeof createB2Client> | undefined;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && !(await isEligibleStudioUserById(session.user.id))) {
      return NextResponse.json({ error: "Creator account is not eligible." }, { status: 403 });
    }
    if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const body = await request.json();
    const episodeId = typeof body.episodeId === "string" ? body.episodeId : "";
    if (!episodeId) return NextResponse.json({ error: "Invalid episode ID." }, { status: 400 });

    const episode = await prisma.podcastEpisode.findFirst({
      where: {
        id: episodeId,
        status: "UPLOADING",
        podcast: { channel: { owner: { id: session.user.id } } },
      },
      include: { storageConnection: true },
    });
    if (!episode) return NextResponse.json({ error: "Upload record not found." }, { status: 404 });

    const connection = episode.storageConnection;
    client = createB2Client(connection);
    const result = await client.send(new HeadObjectCommand({
      Bucket: connection.bucketName, Key: episode.storageKey,
    }));

    if (!result.ContentLength || BigInt(result.ContentLength) !== episode.sizeBytes ||
        result.ContentType !== episode.contentType) {
      await prisma.podcastEpisode.update({
        where: { id: episode.id }, data: { status: "FAILED" },
      });
      return NextResponse.json({ error: "Uploaded file size or type did not match." }, { status: 400 });
    }

    const updated = await prisma.podcastEpisode.update({
      where: { id: episode.id },
      data: { status: "READY" },
      select: { id: true, title: true, contentType: true, sizeBytes: true, status: true },
    });

    return NextResponse.json({
      success: true,
      episode: { ...updated, sizeBytes: updated.sizeBytes.toString() },
    });
  } catch (error) {
    console.error("Podcast upload completion failed:", error);
    return NextResponse.json({ error: "Could not verify uploaded episode." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
