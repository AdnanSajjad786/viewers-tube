import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminOverview } from "@/lib/admin-overview";

export async function GET(request: NextRequest) {
  await connection();
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    const administrator = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (administrator?.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      );
    }

    const overview = await getAdminOverview();

    return NextResponse.json(overview, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Admin overview API failed:", error);
    return NextResponse.json(
      { error: "Could not load administrator overview." },
      { status: 500 }
    );
  }
}
