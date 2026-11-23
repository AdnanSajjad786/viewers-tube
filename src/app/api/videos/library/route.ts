import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  recordPlatformIncident,
  resolvePlatformIncident,
  withTransientRetry,
} from "@/lib/platform-incidents";

export async function GET() {
  try {
    const videos = await withTransientRetry(() =>
      prisma.video.findMany({
        where: {
          status: "READY",
          visibility: "PUBLIC",
          storageConnection: {
            is: { status: "VERIFIED" },
          },
          channel: {
            is: {
              owner: {
                is: { creatorTerminatedAt: null },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          title: true,
          description: true,
          thumbnailUrl: true,
          category: true,
          createdAt: true,
          channel: {
            select: {
              name: true,
              owner: {
                select: {
                  role: true,
                },
              },
            },
          },
        },
      }),
    );

    const items = videos.map((video) => ({
        id: video.id,
        title: video.title,
        description: video.description,
        thumbnail: video.thumbnailUrl,
        category: video.category,
        published: video.createdAt,
        creator: video.channel.name,
        ownerType: video.channel.owner.role,
        provider: "VIEWERS_TUBE",
      }));

    await resolvePlatformIncident({ source: "VIDEOS_LIBRARY" });

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    await recordPlatformIncident({
      source: "VIDEOS_LIBRARY",
      title: "Native video library unavailable",
      detail: "The public video library query failed after safe automatic retries.",
      error,
    });

    console.error(
      "Native video library failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Could not load Viewers Tube videos." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
