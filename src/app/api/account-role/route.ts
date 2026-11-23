import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTransientRetry } from "@/lib/platform-incidents";

export async function GET() {
  try {
    const requestHeaders = await headers();

    const session = await withTransientRetry(() =>
      auth.api.getSession({ headers: requestHeaders })
    );

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    const user = await withTransientRetry(() =>
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true },
      })
    );

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404, headers: { "Cache-Control": "private, no-store" } }
      );
    }

    return NextResponse.json(
      { role: user.role },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    console.error("[account-role] Temporary authentication/database failure.");
    return NextResponse.json(
      { error: "Account role temporarily unavailable. Please retry." },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store",
          "Retry-After": "2",
        },
      }
    );
  }
}
