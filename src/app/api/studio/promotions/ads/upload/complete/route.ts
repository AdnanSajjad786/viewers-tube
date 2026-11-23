import { createB2Client } from "@/lib/b2-client";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isEligibleStudioUserById } from "@/lib/creator-access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let client: ReturnType<typeof createB2Client> | undefined;

  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user?.id && !(await isEligibleStudioUserById(session.user.id))) {
      return NextResponse.json({ error: "Creator account is not eligible." }, { status: 403 });
    }
    if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const body = await request.json();
    const uploadId = typeof body.uploadId === "string" ? body.uploadId : "";
    if (!uploadId) return NextResponse.json({ error: "Invalid upload ID." }, { status: 400 });

    const upload = await prisma.promotionCreativeUpload.findFirst({
      where: { id: uploadId, userId: session.user.id, status: "UPLOADING" },
    });
    if (!upload) return NextResponse.json({ error: "Image upload record not found." }, { status: 404 });

    const storage = await prisma.storageConnection.findFirst({
      where: {
        id: upload.storageConnectionId,
        userId: session.user.id,
        status: "VERIFIED",
      },
    });
    if (!storage) return NextResponse.json({ error: "Verified storage connection not found." }, { status: 403 });

    client = createB2Client(storage);
    const result = await client.send(new HeadObjectCommand({
      Bucket: storage.bucketName,
      Key: upload.storageKey,
    }));

    if (!result.ContentLength ||
        BigInt(result.ContentLength) !== upload.sizeBytes ||
        result.ContentType !== upload.contentType) {
      await prisma.promotionCreativeUpload.update({
        where: { id: upload.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json({ error: "Uploaded image size or type did not match." }, { status: 400 });
    }

    await prisma.promotionCreativeUpload.update({
      where: { id: upload.id },
      data: { status: "READY" },
    });

    return NextResponse.json({ success: true, uploadId: upload.id });
  } catch (error) {
    console.error("Promotion image upload verification failed:", error);
    return NextResponse.json({ error: "Could not verify uploaded image." }, { status: 500 });
  } finally {
    client?.destroy();
  }
}
