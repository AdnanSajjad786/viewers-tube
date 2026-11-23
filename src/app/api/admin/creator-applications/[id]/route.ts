import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  sendCreatorApplicationDecision,
  sendAdminCreatorApplicationDecision,
} from "@/lib/email";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const admin = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });
    if (admin?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const decision = body?.decision;
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : "";

    if (decision !== "APPROVED" && decision !== "REJECTED") {
      return NextResponse.json({ error: "Choose APPROVED or REJECTED." }, { status: 400 });
    }

    const applicant = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id },
        select: {
          id: true, username: true, displayName: true, email: true,
          emailVerified: true, creatorApplicationStatus: true, creatorTerminatedAt: true,
        },
      });
      if (!user || user.creatorApplicationStatus !== "PENDING") {
        throw new Error("APPLICATION_NOT_PENDING");
      }
      if (decision === "APPROVED" && !user.emailVerified) {
        throw new Error("EMAIL_NOT_VERIFIED");
      }
      if (decision === "APPROVED" && user.creatorTerminatedAt) {
        throw new Error("CREATOR_TERMINATED");
      }

      if (decision === "APPROVED") {
        const count = await tx.storageConnection.count({
          where: { userId: user.id, status: "VERIFIED" },
        });
        if (count < 1) throw new Error("BACKBLAZE_NOT_VERIFIED");
      }

      if (decision === "APPROVED") {
        const existing = await tx.channel.findUnique({ where: { userId: user.id } });
        if (!existing) {
          await tx.channel.create({
            data: {
              userId: user.id,
              name: user.displayName || user.username,
              slug: `${user.username}-${user.id.slice(-6)}`,
            },
          });
        }
      }

      await tx.user.update({
        where: { id: user.id },
        data: {
          role: decision === "APPROVED" ? "CREATOR" : "VIEWER",
          creatorApplicationStatus: decision,
          creatorApplicationReviewedAt: new Date(),
          creatorApplicationReviewedById: session.user.id,
          creatorApplicationReviewNote: note || null,
        },
      });
      return user;
    });

    const reviewedAt = new Date();
    const notificationResults = await Promise.allSettled([
      sendCreatorApplicationDecision(applicant.email, {
        displayName: applicant.displayName,
        decision,
        note,
      }),
      sendAdminCreatorApplicationDecision(admin.email, {
        creatorName: applicant.displayName,
        creatorEmail: applicant.email,
        decision,
        note,
        reviewedAt,
      }),
    ]);

    if (notificationResults[0].status === "rejected") {
      console.error("Creator decision email failed:", notificationResults[0].reason);
    }
    if (notificationResults[1].status === "rejected") {
      console.error("Admin decision notification failed:", notificationResults[1].reason);
    }

    return NextResponse.json({ success: true, decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "APPLICATION_NOT_PENDING") {
      return NextResponse.json({ error: "This application is no longer pending." }, { status: 409 });
    }
    if (message === "EMAIL_NOT_VERIFIED") {
      return NextResponse.json({ error: "Applicant must verify their email before approval." }, { status: 403 });
    }
    if (message === "CREATOR_TERMINATED") {
      return NextResponse.json({ error: "A terminated Creator cannot be re-approved." }, { status: 403 });
    }
    if (message === "BACKBLAZE_NOT_VERIFIED") {
      return NextResponse.json({ error: "Connect and verify at least one Backblaze account before approval." }, { status: 403 });
    }
    console.error("Creator application review failed:", error);
    return NextResponse.json({ error: "Could not review application." }, { status: 500 });
  }
}
