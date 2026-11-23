import { createB2Client } from "@/lib/b2-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isEligibleStudioUserById } from "@/lib/creator-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let client: ReturnType<typeof createB2Client> | undefined;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && !(await isEligibleStudioUserById(session.user.id))) {
      return NextResponse.json({ error: "Creator account is not eligible." }, { status: 403 });
    }
    if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const actor = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });
    if (!actor || !["ADMIN", "CREATOR"].includes(actor.role)) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { id } = await params;
    const ad = await prisma.promotionAd.findUnique({
      where: { id },
      select: {
        creativeStorageConnectionId: true,
        creativeStorageKey: true,
        campaign: { select: { ownerId: true } },
      },
    });

    if (!ad?.creativeStorageConnectionId || !ad.creativeStorageKey) {
      return NextResponse.json({ error: "Stored creative not found." }, { status: 404 });
    }

    if (actor.role !== "ADMIN" && ad.campaign.ownerId !== actor.id) {
      return NextResponse.json({ error: "You cannot view this creative." }, { status: 403 });
    }

    const storage = await prisma.storageConnection.findFirst({
      where: {
        id: ad.creativeStorageConnectionId,
        userId: ad.campaign.ownerId,
        status: "VERIFIED",
      },
    });
    if (!storage) return NextResponse.json({ error: "Creative storage is unavailable." }, { status: 404 });

    client = createB2Client(storage);
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: storage.bucketName,
        Key: ad.creativeStorageKey,
      }),
      { expiresIn: 300 },
    );

    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Promotion creative preview failed:", error);
    return NextResponse.json({ error: "Could not open creative preview." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
