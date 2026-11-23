import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withTransientRetry } from "@/lib/platform-incidents";

export async function GET() {
  try {
    const podcasts = await withTransientRetry(() => prisma.podcast.findMany({
      where: {
        status: "PUBLISHED",
        visibility: "PUBLIC",
        episodes: {
          some: {
            status: "PUBLISHED",
            storageConnection: { status: "VERIFIED" },
          },
        },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        artworkUrl: true,
        category: true,
        language: true,
        channel: { select: { name: true, slug: true } },
        episodes: {
          where: {
            status: "PUBLISHED",
            storageConnection: { status: "VERIFIED" },
          },
          orderBy: { publishedAt: "desc" },
          take: 10,
          select: {
            id: true,
            title: true,
            description: true,
            contentType: true,
            sizeBytes: true,
            thumbnailUrl: true,
            durationSeconds: true,
            publishedAt: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }));

    return NextResponse.json({
      podcasts: podcasts.map(p => ({
        ...p,
        episodes: p.episodes.map(e => ({
          ...e,
          sizeBytes: e.sizeBytes.toString(),
        })),
      })),
    }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.error("Public podcast feed failed:", error);
    return NextResponse.json({ error: "Could not load podcasts." }, { status: 500 });
  }
}
