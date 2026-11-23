import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Request origin not allowed." }, { status: 403 });
  }

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json({ error: "Admin or Creator access required." }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as {
      action?: unknown;
      id?: unknown;
    } | null;

    const scope = user.role === "ADMIN" ? {} : { actorUserId: user.id };

    if (body?.action === "delete") {
      if (typeof body.id !== "string" || body.id.length < 1 || body.id.length > 128) {
        return NextResponse.json({ error: "A valid history entry ID is required." }, { status: 400 });
      }

      const result = await prisma.repairAuditEvent.deleteMany({
        where: { id: body.id, ...scope },
      });

      if (result.count === 0) {
        return NextResponse.json(
          { error: "History entry not found in your permitted scope." },
          { status: 404 }
        );
      }

      return NextResponse.json({ message: "History entry deleted.", deleted: result.count });
    }

    if (body?.action === "clear") {
      const result = await prisma.repairAuditEvent.deleteMany({ where: scope });
      return NextResponse.json({
        message: `Cleared ${result.count} repair history entr${result.count === 1 ? "y" : "ies"}.`,
        deleted: result.count,
      });
    }

    return NextResponse.json({ error: "Invalid history action." }, { status: 400 });
  } catch (error) {
    console.error("[repair-centre] History action failed:", error);
    return NextResponse.json({ error: "Could not update repair history." }, { status: 500 });
  }
}
