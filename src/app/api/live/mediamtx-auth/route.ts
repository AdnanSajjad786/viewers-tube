import { prisma } from "@/lib/prisma";
import { verifyStreamSecret } from "@/lib/live-stream-auth";

// MediaMTX delegates publishing and playback authorization to this route.
export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      user?: string;
      password?: string;
      action?: string;
      path?: string;
      protocol?: string;
    };

    const action = body.action || "";
    const path = typeof body.path === "string" ? body.path : "";

    if (!path || path.length > 180) {
      return new Response(null, { status: 401 });
    }

    const stream = await prisma.liveStream.findUnique({
      where: { streamPath: path },
      select: {
        streamKeyHash: true,
        browserStreamKeyHash: true,
        enabled: true,
        visibility: true,
      },
    });

    if (!stream || !stream.enabled) {
      return new Response(null, { status: 401 });
    }

    if (action === "publish") {
      const validUser = body.user === path;
      const password = typeof body.password === "string" ? body.password : "";

      if (body.protocol === "webrtc") {
        const validSecret =
          !!stream.browserStreamKeyHash &&
          !!password &&
          verifyStreamSecret(password, stream.browserStreamKeyHash);

        return new Response(null, {
          status: validUser && validSecret ? 200 : 401,
        });
      }

      if (body.protocol === "rtmp") {
        const validSecret =
          !!password && verifyStreamSecret(password, stream.streamKeyHash);

        return new Response(null, {
          status: validUser && validSecret ? 200 : 401,
        });
      }

      return new Response(null, { status: 401 });
    }

    if (action === "read" || action === "playback") {
      return new Response(null, {
        status: stream.visibility === "PUBLIC" ? 200 : 401,
      });
    }

    return new Response(null, { status: 401 });
  } catch (error) {
    console.error("MediaMTX authorization failed:", error);
    return new Response(null, { status: 401 });
  }
}
