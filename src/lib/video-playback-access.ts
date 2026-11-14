import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getPlayableVideo(id: string) {
  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      storageConnection: true,
      channel: {
        include: { owner: { select: { id: true, role: true } } },
      },
      renditions: { orderBy: { height: "asc" } },
      transcodeJob: true,
    },
  });

  if (
    !video ||
    video.status !== "READY" ||
    !video.storageConnection ||
    !video.storageKey ||
    video.storageConnection.status !== "VERIFIED"
  ) return null;

  const session = await auth.api.getSession({ headers: await headers() });
  const isOwner = session?.user.id === video.channel.owner.id;
  const isAdmin = session
    ? !!(await prisma.user.findFirst({
        where: { id: session.user.id, role: "ADMIN" },
        select: { id: true },
      }))
    : false;

  if (video.visibility === "PRIVATE" && !isOwner && !isAdmin) return null;

  if (video.channel.owner.role === "CREATOR") {
    const owner = await prisma.user.findUnique({
      where: { id: video.channel.owner.id },
      select: { creatorTerminatedAt: true },
    });
    if (owner?.creatorTerminatedAt) return null;
  }

  return video;
}
