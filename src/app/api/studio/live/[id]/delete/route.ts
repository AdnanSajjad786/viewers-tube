import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;

    const stream = await prisma.liveStream.findUnique({
      where: { id },
      include: { channel: { select: { userId: true } } },
    });

    if (!stream) {
      return NextResponse.json({ error: "Broadcast not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && stream.channel.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (stream.enabled) {
      return NextResponse.json(
        { error: "Stop this broadcast before deleting it." },
        { status: 409 }
      );
    }

    await prisma.liveStream.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Delete live broadcast error:", error);
    return NextResponse.json(
      { error: "Could not delete broadcast." },
      { status: 500 }
    );
  }
}
