import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  issueConfirmedCreatorStrike,
  MODERATION_POLICY_CODES,
} from "@/lib/moderation";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const administrator = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (administrator?.role !== "ADMIN") {
      return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const userId = data.userId;
    const videoId = data.videoId;
    const policyCode = data.policyCode;
    const reason = data.reason;

    if (
      typeof userId !== "string" || !userId.trim() ||
      (videoId !== undefined && (typeof videoId !== "string" || !videoId.trim())) ||
      typeof policyCode !== "string" ||
      !(MODERATION_POLICY_CODES as readonly string[]).includes(policyCode) ||
      typeof reason !== "string" || reason.trim().length < 10 ||
      reason.trim().length > 1000
    ) {
      return NextResponse.json(
        { error: "Provide a Creator ID, valid policy code, and a 10–1000 character reason." },
        { status: 400 }
      );
    }

    const result = await issueConfirmedCreatorStrike({
      userId,
      ...(typeof videoId === "string" ? { videoId } : {}),
      policyCode,
      reason: reason.trim(),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const messages: Record<string, string> = {
      CREATOR_NOT_FOUND: "Creator account not found.",
      ADMIN_EXEMPT: "Administrator accounts are exempt from Creator strikes.",
      NOT_A_CREATOR: "The selected account is not a Creator.",
      CREATOR_TERMINATED: "Creator privileges have already been terminated.",
      CREATOR_ALREADY_TERMINATED: "The Creator has reached the strike limit.",
      VIDEO_NOT_OWNED_BY_CREATOR: "The video does not belong to this Creator.",
    };

    if (messages[code]) {
      return NextResponse.json({ error: messages[code] }, { status: 409 });
    }

    console.error("Creator moderation request failed:", error);
    return NextResponse.json({ error: "Moderation request could not be completed." }, { status: 500 });
  }
}
