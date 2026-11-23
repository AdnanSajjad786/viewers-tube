import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true, role: true, emailVerified: true,
        creatorAgreementAcceptedAt: true, creatorTerminatedAt: true,
        creatorSuspendedUntil: true,
      },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role))
      return NextResponse.json({ error: "Creator access required." }, { status: 403 });

    if (user.role === "CREATOR" && (
      !user.emailVerified || !user.creatorAgreementAcceptedAt ||
      user.creatorTerminatedAt ||
      (user.creatorSuspendedUntil && user.creatorSuspendedUntil > new Date())
    )) return NextResponse.json({ error: "Creator account is not eligible." }, { status: 403 });

    const body = await request.json();
    const publish = body.publish === true;

    if (typeof body.podcastId === "string") {
      const podcast = await prisma.podcast.findFirst({
        where: {
          id: body.podcastId,
          channel: { owner: { id: user.id } },
        },
        select: { id: true },
      });
      if (!podcast) return NextResponse.json({ error: "Podcast not found." }, { status: 404 });

      const updated = await prisma.podcast.update({
        where: { id: podcast.id },
        data: {
          status: publish ? "PUBLISHED" : "DRAFT",
          visibility: "PUBLIC",
        },
        select: { id: true, title: true, status: true, visibility: true },
      });
      return NextResponse.json({ success: true, podcast: updated });
    }

    if (typeof body.episodeId === "string") {
      const episode = await prisma.podcastEpisode.findFirst({
        where: {
          id: body.episodeId,
          podcast: { channel: { owner: { id: user.id } } },
        },
        include: { podcast: true, storageConnection: true },
      });

      if (!episode) return NextResponse.json({ error: "Episode not found." }, { status: 404 });

      if (publish && (
        episode.status !== "READY" && episode.status !== "PUBLISHED"
      )) return NextResponse.json({ error: "Episode must be uploaded and verified first." }, { status: 400 });

      if (publish && (
        episode.podcast.status !== "PUBLISHED" ||
        episode.podcast.visibility !== "PUBLIC"
      )) return NextResponse.json({ error: "Publish the public podcast first." }, { status: 400 });

      if (publish && episode.storageConnection.status !== "VERIFIED")
        return NextResponse.json({ error: "Episode storage is not verified." }, { status: 400 });

      const updated = await prisma.podcastEpisode.update({
        where: { id: episode.id },
        data: {
          status: publish ? "PUBLISHED" : "READY",
          publishedAt: publish ? (episode.publishedAt || new Date()) : null,
        },
        select: { id: true, title: true, status: true, publishedAt: true },
      });
      return NextResponse.json({ success: true, episode: updated });
    }

    return NextResponse.json({ error: "A podcastId or episodeId is required." }, { status: 400 });
  } catch (error) {
    console.error("Podcast publishing failed:", error);
    return NextResponse.json({ error: "Could not update publishing status." }, { status: 500 });
  }
}
