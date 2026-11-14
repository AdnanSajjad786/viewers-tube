import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";


export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json({ error: "Admin or Creator access required." }, { status: 403 });
    }

    const videos = await prisma.video.findMany({
      where: user.role === "ADMIN"
        ? {}
        : { channel: { owner: { id: user.id } } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        description: true,
        isShort: true,
        status: true,
        visibility: true,
        scheduledAt: true,
        scheduledVisibility: true,
        language: true,
        category: true,
        thumbnailUrl: true,
        createdAt: true,
        channel: { select: { name: true, owner: { select: { id: true, displayName: true } } } },
        storageConnection: { select: { label: true, bucketName: true } },
        transcodeJob: { select: { status: true } },
        _count: { select: { renditions: true, comments: true, likes: true } },
      },
    });

    return NextResponse.json({
      role: user.role,
      videos: videos.map((video) => ({
        ...video,
        createdAt: video.createdAt.toISOString(),
        ownerName: video.channel.owner.displayName,
        channelName: video.channel.name,
        storageLabel: video.storageConnection?.label || video.storageConnection?.bucketName || "No storage connection",
        renditionCount: video._count.renditions,
        commentCount: video._count.comments,
        likeCount: video._count.likes,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Studio video listing failed:", error);
    return NextResponse.json({ error: "Could not load Studio videos." }, { status: 500 });
  }
}
