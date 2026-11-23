import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Request origin not allowed." },
      { status: 403 }
    );
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in required." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json(
        { error: "Admin or Creator access required." },
        { status: 403 }
      );
    }

    const result = await prisma.platformIncident.deleteMany({
      where: {
        status: "RESOLVED",
        ...(user.role === "ADMIN" ? {} : { actorUserId: user.id }),
      },
    });

    return NextResponse.json({
      success: true,
      deleted: result.count,
      message: `Cleared ${result.count} resolved runtime incident${result.count === 1 ? "" : "s"}. Open incidents were preserved.`,
    });
  } catch (error) {
    console.error("[repair-centre] Clearing resolved incidents failed:", error);
    return NextResponse.json(
      { error: "Could not clear resolved runtime incidents." },
      { status: 500 }
    );
  }
}
