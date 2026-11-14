import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createB2Client } from "@/lib/b2-client";

type Context = { params: Promise<{ id: string }> };

async function authorizedVideo(id: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });

  if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
    return { response: NextResponse.json({ error: "Admin or Creator access required." }, { status: 403 }) };
  }

  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      channel: { include: { owner: { select: { id: true } } } },
      storageConnection: true,
      transcodeJob: true,
    },
  });

  if (!video) {
    return { response: NextResponse.json({ error: "Video not found." }, { status: 404 }) };
  }

  if (user.role !== "ADMIN" && video.channel.owner.id !== user.id) {
    return { response: NextResponse.json({ error: "You can manage only your own videos." }, { status: 403 }) };
  }

  return { user, video };
}

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const access = await authorizedVideo(id);
    if ("response" in access) return access.response;

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const language = typeof body.language === "string" ? body.language.trim() : "";
    const visibility = body.visibility;
    const isShort = typeof body.isShort === "boolean" ? body.isShort : undefined;

    if (!title || title.length > 180 || description.length > 5000 ||
        category.length > 80 || language.length > 20 ||
        !["PUBLIC", "UNLISTED", "PRIVATE"].includes(visibility)) {
      return NextResponse.json({ error: "Check the title, description, category, language and visibility fields." }, { status: 400 });
    }

    const updated = await prisma.video.update({
      where: { id },
      data: {
        title,
        description: description || null,
        category: category || null,
        language: language || null,
        visibility,
        ...(isShort !== undefined ? { isShort } : {}),
      },
      select: { id: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, updatedAt: updated.updatedAt.toISOString() });
  } catch (error) {
    console.error("Studio video update failed:", error);
    return NextResponse.json({ error: "Could not save video details." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const access = await authorizedVideo(id);
    if ("response" in access) return access.response;

    const { video } = access;

    if (video.transcodeJob?.status === "RUNNING") {
      return NextResponse.json({
        error: "This video is currently being processed. Wait for processing to finish before deleting it.",
      }, { status: 409 });
    }

    if (video.storageKey && !video.storageConnection) {
      return NextResponse.json({
        error: "The video's original storage connection is missing. The video was not deleted.",
      }, { status: 409 });
    }

    // Remove only this video's source object and its dedicated HLS folder.
    if (video.storageKey && video.storageConnection) {
      const client = createB2Client(video.storageConnection);
      const bucket = video.storageConnection.bucketName;
      const keys = new Set<string>([video.storageKey]);
      const prefix = `${video.storageKey}.hls/`;
      let continuationToken: string | undefined;

      do {
        const page = await client.send(new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }));

        for (const object of page.Contents || []) {
          if (object.Key) keys.add(object.Key);
        }
        continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (continuationToken);

      const allKeys = [...keys];
      for (let offset = 0; offset < allKeys.length; offset += 1000) {
        const batch = allKeys.slice(offset, offset + 1000);
        const result = await client.send(new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: false },
        }));

        if (result.Errors?.length) {
          console.error("B2 video deletion errors:", result.Errors.map((item) => ({
            key: item.Key, code: item.Code,
          })));
          return NextResponse.json({
            error: "Backblaze could not delete every video file. The database record was kept; retry after checking the storage connection.",
          }, { status: 502 });
        }
      }
    }

    // Keep moderation history, but detach it from the permanently deleted video.
    await prisma.$transaction(async (tx) => {
      await tx.moderationStrike.updateMany({
        where: { videoId: id },
        data: { videoId: null },
      });
      await tx.comment.updateMany({
        where: { videoId: id },
        data: { parentId: null },
      });
      await tx.comment.deleteMany({ where: { videoId: id } });
      await tx.videoLike.deleteMany({ where: { videoId: id } });
      await tx.video.delete({ where: { id } });
    });

    return NextResponse.json({ success: true, deletedVideoId: id });
  } catch (error) {
    console.error("Permanent video deletion failed:", error);
    return NextResponse.json({
      error: "Deletion failed. Check the server log and storage connection before retrying.",
    }, { status: 500 });
  }
}
