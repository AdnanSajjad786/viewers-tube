import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET() {
  try {
    const videos = await prisma.video.findMany({
      where: {
        status: "READY",
        visibility: "PUBLIC",
        storageConnection: {
          is: { status: "VERIFIED" },
        },
        channel: {
          owner: {
            creatorTerminatedAt: null,
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
    });

    return NextResponse.json(
      {
        items: videos.map((video) => ({
          id: video.id,
          title: video.title,
          description: video.description,
          thumbnail: video.thumbnailUrl,
          category: video.category,
          published: video.createdAt,
          creator: video.channel.name,
          ownerType: video.channel.owner.role,
          provider: "VIEWERS_TUBE",
        })),
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Native video library failed:",
      error instanceof Error ? error.message : "Unknown error"
    );

    return NextResponse.json(
      { error: "Could not load Viewers Tube videos." },
      { status: 500 }
    );
  }
}
