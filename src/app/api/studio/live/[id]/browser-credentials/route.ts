import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isEligibleStudioUserById } from "@/lib/creator-access";
import { prisma } from "@/lib/prisma";
import { createStreamSecret } from "@/lib/live-stream-auth";
import { checkRateLimit } from "@/lib/api-protection";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const rate = checkRateLimit(
      request.headers,
      "studio-live-browser-credentials",
      10,
      60_000,
    );

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many browser publishing attempts. Try again shortly." },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfter) },
        },
      );
    }

    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && !(await isEligibleStudioUserById(session.user.id))) {
      return NextResponse.json({ error: "Creator account is not eligible." }, { status: 403 });
    }

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
      select: {
        id: true,
        streamPath: true,
        enabled: true,
        channel: {
          select: { owner: { select: { id: true } } },
        },
      },
    });

    if (!stream) {
      return NextResponse.json(
        { error: "Live stream not found." },
        { status: 404 },
      );
    }

    if (user.role !== "ADMIN" && stream.channel.owner.id !== user.id) {
      return NextResponse.json(
        { error: "You can manage only your own streams." },
        { status: 403 },
      );
    }

    if (!stream.enabled) {
      return NextResponse.json(
        { error: "This stream has been stopped. Create a new stream to broadcast." },
        { status: 409 },
      );
    }

    const { secret, hash } = createStreamSecret();

    await prisma.liveStream.update({
      where: { id: stream.id },
      data: { browserStreamKeyHash: hash },
    });

    return NextResponse.json(
      {
        username: stream.streamPath,
        password: secret,
        whipPath: `/${stream.streamPath}/whip`,
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("Browser publishing credential creation failed:", error);
    return NextResponse.json(
      { error: "Could not prepare browser publishing." },
      { status: 500 },
    );
  }
}
