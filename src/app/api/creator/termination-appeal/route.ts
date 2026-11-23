import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!user || user.role !== "CREATOR") {
    return NextResponse.json({ error: "Creator account required." }, { status: 403 });
  }

  const termination = await prisma.creatorTermination.findFirst({
    where: { userId: user.id },
    orderBy: { terminatedAt: "desc" },
    select: {
      id: true,
      reason: true,
      evidenceReference: true,
      status: true,
      terminatedAt: true,
      appealedAt: true,
      appealMessage: true,
      reviewedAt: true,
      reviewerNote: true,
    },
  });

  return NextResponse.json({ termination });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message || message.length < 20 || message.length > 2000) {
    return NextResponse.json({ error: "Your appeal must be 20–2000 characters." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true, creatorTerminatedAt: true },
      });

      if (!user || user.role !== "CREATOR" || !user.creatorTerminatedAt) {
        throw new Error("NOT_DIRECTLY_TERMINATED");
      }

      const termination = await tx.creatorTermination.findFirst({
        where: {
          userId: user.id,
          status: "NOT_APPEALED",
        },
        orderBy: { terminatedAt: "desc" },
      });

      if (!termination) throw new Error("NO_APPEALABLE_TERMINATION");

      return tx.creatorTermination.update({
        where: { id: termination.id },
        data: {
          status: "OPEN",
          appealMessage: message,
          appealedAt: new Date(),
          reviewerNote: null,
          reviewerId: null,
        },
      });
    });

    return NextResponse.json({ success: true, appealId: result.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_DIRECTLY_TERMINATED") {
      return NextResponse.json({ error: "No direct Creator termination is available to appeal." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "NO_APPEALABLE_TERMINATION") {
      return NextResponse.json({ error: "No new appeal is available for this termination." }, { status: 409 });
    }
    console.error("Creator termination appeal failed:", error);
    return NextResponse.json({ error: "Could not submit your appeal." }, { status: 500 });
  }
}
