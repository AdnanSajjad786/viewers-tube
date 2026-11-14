import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStreamSecret } from "@/lib/live-stream-auth";
import { checkRateLimit } from "@/lib/api-protection";


async function getStudioUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || !["ADMIN", "CREATOR"].includes(user.role)) return null;
  return user;
}

async function getLivePathNames() {
  const base = (process.env.MEDIAMTX_API_URL || "http://127.0.0.1:9997").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/v3/paths/list`, {
      cache: "no-store",
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) return new Set<string>();
    const data = await response.json() as { items?: Array<{ name?: string; ready?: boolean }> };
    return new Set((data.items || []).filter((item) => item.ready && item.name).map((item) => item.name as string));
  } catch {
    return new Set<string>();
  }
}

export async function GET() {
  try {
    const user = await getStudioUser();
    if (!user) return NextResponse.json({ error: "Creator or admin sign-in required." }, { status: 401 });
    const channel = await prisma.channel.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!channel) return NextResponse.json({ streams: [], message: "Create a creator channel before starting a live stream." });

    const [streams, livePaths] = await Promise.all([
      prisma.liveStream.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, title: true, description: true, streamPath: true, visibility: true, enabled: true, createdAt: true, endedAt: true },
      }),
      getLivePathNames(),
    ]);

    return NextResponse.json({
      streams: streams.map((stream) => ({
        ...stream,
        createdAt: stream.createdAt.toISOString(),
        endedAt: stream.endedAt?.toISOString() || null,
        isLive: stream.enabled && livePaths.has(stream.streamPath),
        playbackUrl: `http://localhost:8888/${stream.streamPath}/index.m3u8`,
      })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Live stream listing failed:", error);
    return NextResponse.json({ error: "Could not load live streams." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const rate = checkRateLimit(request.headers, "studio-live-create", 5, 60_000);
    if (!rate.allowed) return NextResponse.json({ error: "Too many live stream creation attempts. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
    const user = await getStudioUser();
    if (!user) return NextResponse.json({ error: "Creator or admin sign-in required." }, { status: 401 });
    const channel = await prisma.channel.findUnique({ where: { userId: user.id }, select: { id: true } });
    if (!channel) return NextResponse.json({ error: "A creator channel is required to broadcast." }, { status: 403 });

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const visibility = "PUBLIC" as const;
    if (!title || title.length > 120 || description.length > 2000) {
      return NextResponse.json({ error: "Enter a title up to 120 characters and a description up to 2,000 characters." }, { status: 400 });
    }

    const streamPath = `vt-${randomBytes(12).toString("hex")}`;
    const { secret, hash } = createStreamSecret();
    const stream = await prisma.liveStream.create({
      data: { channelId: channel.id, title, description: description || null, streamPath, streamKeyHash: hash, visibility },
      select: { id: true, title: true, streamPath: true, visibility: true, createdAt: true },
    });

    const publishUrl = `rtmp://localhost:1935/${streamPath}?user=${streamPath}&pass=${encodeURIComponent(secret)}`;
    return NextResponse.json({
      stream: { ...stream, createdAt: stream.createdAt.toISOString() },
      publishUrl,
      playbackUrl: `http://localhost:8888/${streamPath}/index.m3u8`,
      warning: "The publishing URL contains a secret. Copy it now and do not share it. It will not be shown again.",
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Live stream creation failed:", error);
    return NextResponse.json({ error: "Could not create a live stream." }, { status: 500 });
  }
}
