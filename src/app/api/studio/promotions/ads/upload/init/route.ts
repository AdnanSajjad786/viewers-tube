import { createB2Client } from "@/lib/b2-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isEligibleStudioUserById } from "@/lib/creator-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};
const MAX_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  let client: ReturnType<typeof createB2Client> | undefined;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && !(await isEligibleStudioUserById(session.user.id))) {
      return NextResponse.json({ error: "Creator account is not eligible." }, { status: 403 });
    }
    if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        emailVerified: true,
        creatorAgreementAcceptedAt: true,
        creatorTerminatedAt: true,
        creatorSuspendedUntil: true,
        storageConnections: {
          where: { status: "VERIFIED" },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        },
      },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json({ error: "Creator or Admin access required." }, { status: 403 });
    }

    if (user.role === "CREATOR") {
      if (!user.emailVerified || !user.creatorAgreementAcceptedAt ||
          user.creatorTerminatedAt ||
          (user.creatorSuspendedUntil && user.creatorSuspendedUntil > new Date())) {
        return NextResponse.json({ error: "Your Creator account is not eligible to upload." }, { status: 403 });
      }

      const access = await prisma.promotionAccessRequest.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      if (access?.status !== "APPROVED") {
        return NextResponse.json({ error: "Promotions access must be approved before uploading." }, { status: 403 });
      }
    }

    const body = await request.json();
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const size = Number(body.size);

    if (!IMAGE_TYPES[contentType] || !Number.isSafeInteger(size) || size < 1 || size > MAX_SIZE) {
      return NextResponse.json({
        error: "Choose a JPEG, PNG, WebP, GIF or AVIF image no larger than 10 MB.",
      }, { status: 400 });
    }

    const storage = user.storageConnections[0];
    if (!storage) {
      return NextResponse.json({
        error: "Connect and verify a Backblaze B2 storage bucket before uploading.",
      }, { status: 400 });
    }

    const storageKey = `${storage.prefix ? storage.prefix + "/" : ""}${user.id}/promotions/${crypto.randomUUID()}.${IMAGE_TYPES[contentType]}`;

    const upload = await prisma.promotionCreativeUpload.create({
      data: {
        userId: user.id,
        storageConnectionId: storage.id,
        storageKey,
        contentType,
        sizeBytes: BigInt(size),
        status: "UPLOADING",
      },
      select: { id: true },
    });

    client = createB2Client(storage);
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: storage.bucketName,
        Key: storageKey,
        ContentType: contentType,
      }),
      { expiresIn: 900 },
    );

    return NextResponse.json({
      uploadId: upload.id,
      uploadUrl,
      requiredHeaders: { "Content-Type": contentType },
      expiresIn: 900,
    });
  } catch (error) {
    console.error("Promotion image upload initialization failed:", error);
    return NextResponse.json({ error: "Could not start image upload." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
