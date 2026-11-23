import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function isAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return false;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  return user?.role === "ADMIN";
}

export async function GET() {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }
    const applications = await prisma.user.findMany({
      where: { creatorApplicationStatus: "PENDING" },
      orderBy: { creatorApplicationSubmittedAt: "asc" },
      select: {
        id: true, username: true, displayName: true, email: true,
        creatorApplicationSubmittedAt: true, creatorAgreementVersion: true,
        creatorAgreementAcceptedAt: true,
        emailVerified: true,
        storageConnections: {
          select: { id: true, label: true, bucketName: true, region: true, status: true, isDefault: true, verifiedAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    return NextResponse.json({ applications });
  } catch (error) {
    console.error("Creator application list failed:", error);
    return NextResponse.json({ error: "Could not load applications." }, { status: 500 });
  }
}
