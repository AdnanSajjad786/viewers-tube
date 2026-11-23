import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendCreatorDirectTerminationNotice } from "@/lib/email";

async function requireAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  return user?.role === "ADMIN" ? user : null;
}

export async function GET() {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (error) {
    console.error("Admin Creator termination authorization failed:", error);
    return NextResponse.json({ error: "Could not verify Admin access." }, { status: 500 });
  }

  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const [creatorsResult, appealsResult] = await Promise.allSettled([
    prisma.user.findMany({
      where: {
        role: "CREATOR",
        creatorApplicationStatus: "APPROVED",
        creatorTerminatedAt: null,
      },
      select: { id: true, username: true, displayName: true, email: true },
      orderBy: { displayName: "asc" },
    }),
    prisma.creatorTermination.findMany({
      where: { status: "OPEN" },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, email: true },
        },
      },
      orderBy: { appealedAt: "asc" },
    }),
  ]);

  const errors: { creators?: string; appeals?: string } = {};
  if (creatorsResult.status === "rejected") {
    console.error("Admin Creator termination list query failed:", creatorsResult.reason);
    errors.creators = "Could not load active Creator accounts.";
  }
  if (appealsResult.status === "rejected") {
    console.error("Admin Creator termination appeals query failed:", appealsResult.reason);
    errors.appeals = "Could not load termination appeals.";
  }

  const creators = creatorsResult.status === "fulfilled" ? creatorsResult.value : [];
  const appeals = appealsResult.status === "fulfilled" ? appealsResult.value : [];
  const bothFailed = creatorsResult.status === "rejected" && appealsResult.status === "rejected";

  return NextResponse.json(
    { creators, appeals, errors },
    { status: bothFailed ? 500 : 200 },
  );
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  let body: { userId?: string; reason?: string; evidenceReference?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userId = body.userId?.trim();
  const reason = body.reason?.trim();
  const evidenceReference = body.evidenceReference?.trim() || null;

  if (!userId || !reason || reason.length < 10 || reason.length > 2000) {
    return NextResponse.json(
      { error: "Select a Creator and provide a reason of 10–2000 characters." },
      { status: 400 },
    );
  }
  if (evidenceReference && evidenceReference.length > 1000) {
    return NextResponse.json({ error: "Evidence reference is too long." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          email: true,
          displayName: true,
          creatorTerminatedAt: true,
        },
      });

      if (
        !target ||
        target.role !== "CREATOR"
      ) {
        throw new Error("CREATOR_NOT_ELIGIBLE");
      }
      if (target.creatorTerminatedAt) throw new Error("ALREADY_TERMINATED");

      const termination = await tx.creatorTermination.create({
        data: { userId, reason, evidenceReference },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          creatorTerminatedAt: termination.terminatedAt,
          creatorSuspendedUntil: null,
        },
      });

      await tx.session.deleteMany({ where: { userId } });

      return {
        termination,
        email: target.email,
        displayName: target.displayName,
      };
    });

    let emailSent = false;
    try {
      await sendCreatorDirectTerminationNotice(result.email, {
        displayName: result.displayName,
        reason,
        evidenceReference,
      });
      await prisma.creatorTermination.update({
        where: { id: result.termination.id },
        data: { notificationSentAt: new Date() },
      });
      emailSent = true;
    } catch (error) {
      console.error("Direct Creator termination email failed:", error);
    }

    return NextResponse.json(
      { success: true, terminationId: result.termination.id, emailSent },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CREATOR_NOT_ELIGIBLE") {
      return NextResponse.json({ error: "Only an active Creator account can be terminated here." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "ALREADY_TERMINATED") {
      return NextResponse.json({ error: "This Creator is already terminated." }, { status: 409 });
    }
    console.error("Creator termination failed:", error);
    return NextResponse.json({ error: "Could not terminate Creator account." }, { status: 500 });
  }
}
