import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: Context) {
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
      return NextResponse.json(
        { error: "Creator or admin access required." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const stream = await prisma.liveStream.findUnique({
      where: { id },
      include: { channel: { select: { owner: { select: { id: true } } } } },
    });

    if (!stream) {
      return NextResponse.json({ error: "Live stream not found." }, { status: 404 });
    }

    if (user.role !== "ADMIN" && stream.channel.owner.id !== user.id) {
      return NextResponse.json(
        { error: "You can manage only your own streams." },
        { status: 403 },
      );
    }

    // Revoke publishing before disconnecting active publishers.
    await prisma.liveStream.update({
      where: { id },
      data: { enabled: false, endedAt: new Date(), browserStreamKeyHash: null },
    });

    const base = (process.env.MEDIAMTX_API_URL || "http://127.0.0.1:9997").replace(/\/$/, "");

    // Disconnect an active RTMP/OBS publisher.
    try {
      const response = await fetch(`${base}/v3/rtmp/conns/list`, {
        cache: "no-store",
        signal: AbortSignal.timeout(1500),
      });

      if (response.ok) {
        const data = await response.json() as {
          items?: Array<{ id?: string; path?: string }>;
        };

        const connection = (data.items || []).find(
          (item) => item.path === stream.streamPath && item.id,
        );

        if (connection?.id) {
          await fetch(
            `${base}/v3/rtmp/conns/kick/${encodeURIComponent(connection.id)}`,
            { method: "POST", signal: AbortSignal.timeout(1500) },
          );
        }
      }
    } catch (error) {
      console.warn("Could not actively disconnect the RTMP publisher.", error);
    }

    // Disconnect active browser WebRTC publishers.
    try {
      const response = await fetch(`${base}/v3/webrtc/sessions/list`, {
        cache: "no-store",
        signal: AbortSignal.timeout(1500),
      });

      if (response.ok) {
        const data = await response.json() as {
          items?: Array<{ id?: string; path?: string; state?: string }>;
        };

        const publishers = (data.items || []).filter(
          (item) =>
            item.path === stream.streamPath &&
            item.state === "publish" &&
            item.id,
        );

        await Promise.all(
          publishers.map((publisher) =>
            fetch(
              `${base}/v3/webrtc/sessions/kick/${encodeURIComponent(publisher.id!)}`,
              { method: "POST", signal: AbortSignal.timeout(1500) },
            ),
          ),
        );
      }
    } catch (error) {
      console.warn("Could not actively disconnect the WebRTC publisher.", error);
    }

    return NextResponse.json({ success: true, stopped: true });
  } catch (error) {
    console.error("Live stream stop failed:", error);
    return NextResponse.json(
      { error: "Could not stop the live stream." },
      { status: 500 },
    );
  }
}
