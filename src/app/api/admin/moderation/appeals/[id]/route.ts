import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (admin?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const decision = body?.decision;
    const reviewerNote =
      typeof body?.reviewerNote === "string"
        ? body.reviewerNote.trim()
        : "";

    if (
      (decision !== "APPROVED" && decision !== "REJECTED") ||
      reviewerNote.length > 2000
    ) {
      return NextResponse.json(
        { error: "Choose APPROVED or REJECTED and provide a note under 2000 characters." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const appeal = await tx.moderationAppeal.findUnique({
        where: { id },
        include: { strike: true },
      });

      if (!appeal || appeal.status !== "OPEN") {
        throw new Error("APPEAL_NOT_OPEN");
      }

      const reviewedAt = new Date();

      const updatedAppeal = await tx.moderationAppeal.update({
        where: { id },
        data: {
          status: decision,
          reviewedAt,
          reviewerNote: reviewerNote || null,
        },
      });

      if (decision === "APPROVED") {
        await tx.moderationStrike.update({
          where: { id: appeal.strikeId },
          data: { status: "REVERSED" },
        });

        const remaining = await tx.moderationStrike.findMany({
          where: {
            userId: appeal.userId,
            status: "ACTIVE",
            suspensionEndsAt: { not: null },
          },
          select: { suspensionEndsAt: true },
        });

        const latestEnd = remaining.reduce<Date | null>((latest, item) => {
          const end = item.suspensionEndsAt;
          return end && (!latest || end > latest) ? end : latest;
        }, null);

        await tx.user.update({
          where: { id: appeal.userId },
          data: {
            creatorSuspendedUntil:
              latestEnd && latestEnd > reviewedAt ? latestEnd : null,
            ...(appeal.strike.strikeNumber === 4
              ? { creatorTerminatedAt: null }
              : {}),
          },
        });
      }

      return updatedAppeal;
    });

    return NextResponse.json({ success: true, appeal: result });
  } catch (error) {
    if (error instanceof Error && error.message === "APPEAL_NOT_OPEN") {
      return NextResponse.json(
        { error: "Appeal not found or already reviewed." },
        { status: 409 },
      );
    }

    console.error("Admin appeal review failed:", error);
    return NextResponse.json(
      { error: "Could not review the appeal." },
      { status: 500 },
    );
  }
}
