import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: "Request origin not allowed." },
      { status: 403 },
    );
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in required." },
        { status: 401 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Admin access required." },
        { status: 403 },
      );
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 180);

    const [eligibleResolved, openIncidents, retainedResolved] =
      await Promise.all([
        prisma.platformIncident.count({
          where: {
            status: "RESOLVED",
            resolvedAt: { lt: cutoff },
          },
        }),
        prisma.platformIncident.count({
          where: { status: "OPEN" },
        }),
        prisma.platformIncident.count({
          where: {
            status: "RESOLVED",
            OR: [
              { resolvedAt: null },
              { resolvedAt: { gte: cutoff } },
            ],
          },
        }),
      ]);

    return NextResponse.json(
      {
        mode: "DRY_RUN_ONLY",
        retentionDays: 180,
        cutoff: cutoff.toISOString(),
        eligibleResolved,
        retainedResolved,
        preservedOpen: openIncidents,
        deleted: 0,
        message:
          "Preview only. No records were changed. Cleanup is disabled until the database environment is verified and separately approved.",
      },
      {
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error) {
    console.error("[repair-centre] Retention preview failed:", error);
    return NextResponse.json(
      { error: "Could not generate the retention preview." },
      { status: 500 },
    );
  }
}
