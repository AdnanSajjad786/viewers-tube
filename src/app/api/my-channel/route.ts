import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/api-protection";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request.headers, "my-channel", 20);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfter) },
      },
    );
  }

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Please sign in to view your channel." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        role: true,
        creatorTerminatedAt: true,
        creatorSuspendedUntil: true,
        channel: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            createdAt: true,
            updatedAt: true,
            _count: {
              select: {
                subscribers: true,
                videos: true,
              },
            },
            videos: {
              orderBy: { createdAt: "desc" },
              take: 50,
              select: {
                id: true,
                title: true,
                description: true,
                videoUrl: true,
                thumbnailUrl: true,
                language: true,
                category: true,
                status: true,
                visibility: true,
                createdAt: true,
                updatedAt: true,
                removedAt: true,
                removalReason: true,
                _count: {
                  select: {
                    likes: true,
                    comments: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (user.role !== "CREATOR" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "A Creator account is required." },
        { status: 403 },
      );
    }

    if (user.creatorTerminatedAt) {
      return NextResponse.json(
        { error: "Creator privileges have been terminated." },
        { status: 403 },
      );
    }

    if (!user.channel) {
      return NextResponse.json({
        channel: null,
        videos: [],
        message: "Your channel has not been created yet.",
      });
    }

    return NextResponse.json({
      channel: {
        id: user.channel.id,
        name: user.channel.name,
        slug: user.channel.slug,
        description: user.channel.description,
        createdAt: user.channel.createdAt,
        updatedAt: user.channel.updatedAt,
        subscriberCount: user.channel._count.subscribers,
        totalVideoCount: user.channel._count.videos,
      },
      videos: user.channel.videos,
      creatorStatus: {
        suspended: Boolean(
          user.creatorSuspendedUntil &&
          user.creatorSuspendedUntil > new Date(),
        ),
        suspendedUntil: user.creatorSuspendedUntil,
      },
    });
  } catch (error) {
    console.error("My channel API failed:", error);
    return NextResponse.json(
      { error: "Could not load your channel." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const rate = checkRateLimit(request.headers, "my-channel-update", 10);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many update requests." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfter) },
      },
    );
  }

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, creatorTerminatedAt: true },
    });

    if (user?.role !== "CREATOR" && user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Creator access is required." },
        { status: 403 },
      );
    }

    if (user.creatorTerminatedAt) {
      return NextResponse.json(
        { error: "Creator privileges have been terminated." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const input = body as Record<string, unknown>;
    const data: { name?: string; description?: string | null } = {};

    if ("name" in input) {
      if (typeof input.name !== "string") {
        return NextResponse.json({ error: "Invalid channel name." }, { status: 400 });
      }
      const name = input.name.trim();
      if (name.length < 2 || name.length > 80) {
        return NextResponse.json(
          { error: "Channel name must be 2–80 characters." },
          { status: 400 },
        );
      }
      data.name = name;
    }

    if ("description" in input) {
      if (typeof input.description !== "string") {
        return NextResponse.json({ error: "Invalid description." }, { status: 400 });
      }
      const description = input.description.trim();
      if (description.length > 1000) {
        return NextResponse.json(
          { error: "Description must be 1000 characters or fewer." },
          { status: 400 },
        );
      }
      data.description = description || null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Provide a channel name or description to update." },
        { status: 400 },
      );
    }

    const channel = await prisma.channel.update({
      where: { userId: session.user.id },
      data,
      select: { id: true, name: true, slug: true, description: true },
    });

    return NextResponse.json({ success: true, channel });
  } catch (error) {
    console.error("Channel profile update failed:", error);
    return NextResponse.json(
      { error: "Could not update your channel." },
      { status: 500 },
    );
  }
}
