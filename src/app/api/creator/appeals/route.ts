import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
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

    if (user?.role !== "CREATOR" || user.creatorTerminatedAt) {
      return NextResponse.json(
        { error: "An active Creator account is required to appeal." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => null);
    const strikeId =
      body && typeof body.strikeId === "string" ? body.strikeId : "";
    const message =
      body && typeof body.message === "string" ? body.message.trim() : "";

    if (!strikeId || message.length < 20 || message.length > 2000) {
      return NextResponse.json(
        { error: "Provide a strike ID and an appeal message of 20–2000 characters." },
        { status: 400 },
      );
    }

    const strike = await prisma.moderationStrike.findFirst({
      where: {
        id: strikeId,
        userId: session.user.id,
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!strike) {
      return NextResponse.json(
        { error: "Active strike not found for your account." },
        { status: 404 },
      );
    }

    const existing = await prisma.moderationAppeal.findUnique({
      where: { strikeId },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An appeal has already been submitted for this strike." },
        { status: 409 },
      );
    }

    const appeal = await prisma.moderationAppeal.create({
      data: {
        strikeId,
        userId: session.user.id,
        message,
      },
      select: { id: true, status: true, submittedAt: true },
    });

    return NextResponse.json({ success: true, appeal }, { status: 201 });
  } catch (error) {
    console.error("Creator appeal submission failed:", error);
    return NextResponse.json(
      { error: "Could not submit the appeal." },
      { status: 500 },
    );
  }
}
