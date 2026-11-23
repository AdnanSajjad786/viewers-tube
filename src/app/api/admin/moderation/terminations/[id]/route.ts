import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  return user?.role === "ADMIN" ? user : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { id } = await context.params;
  let body: { decision?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const decision = body.decision;
  const note = body.note?.trim() || "";
  if (!["APPROVED", "REJECTED"].includes(decision || "") || note.length > 2000) {
    return NextResponse.json({ error: "Choose a valid decision and a note up to 2000 characters." }, { status: 400 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const termination = await tx.creatorTermination.findUnique({
        where: { id },
        include: { user: { select: { id: true, creatorTerminatedAt: true } } },
      });

      if (!termination || termination.status !== "OPEN") {
        throw new Error("APPEAL_NOT_OPEN");
      }

      if (decision === "APPROVED") {
        const activeFourthStrike = await tx.moderationStrike.findFirst({
          where: {
            userId: termination.userId,
            strikeNumber: 4,
            status: "ACTIVE",
          },
          select: { id: true },
        });

        // A direct-termination appeal cannot reverse a separate fourth-strike termination.
        if (!activeFourthStrike) {
          await tx.user.update({
            where: { id: termination.userId },
            data: { creatorTerminatedAt: null },
          });
        }
      }

      await tx.creatorTermination.update({
        where: { id },
        data: {
          status: decision === "APPROVED" ? "APPROVED" : "REJECTED",
          reviewedAt: new Date(),
          reviewerId: admin.id,
          reviewerNote: note || null,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "APPEAL_NOT_OPEN") {
      return NextResponse.json({ error: "This appeal is no longer open." }, { status: 409 });
    }
    console.error("Termination appeal review failed:", error);
    return NextResponse.json({ error: "Could not review termination appeal." }, { status: 500 });
  }
}
