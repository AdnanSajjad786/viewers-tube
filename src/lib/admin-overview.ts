import { prisma } from "@/lib/prisma";

export async function getAdminOverview() {
  const [
    totalUsers,
    viewers,
    creators,
    admins,
    totalVideos,
    readyVideos,
    removedVideos,
    externalVideos,
    activeStrikes,
    recentUsers,
    recentVideos,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "VIEWER" } }),
    prisma.user.count({ where: { role: "CREATOR" } }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.video.count(),
    prisma.video.count({ where: { status: "READY" } }),
    prisma.video.count({ where: { status: "REMOVED" } }),
    prisma.externalVideo.count(),
    prisma.moderationStrike.count({ where: { status: "ACTIVE" } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    }),
    prisma.video.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        visibility: true,
        createdAt: true,
        channel: {
          select: {
            name: true,
            owner: { select: { displayName: true } },
          },
        },
      },
    }),
  ]);

  return {
    totals: {
      totalUsers,
      viewers,
      creators,
      admins,
      totalVideos,
      readyVideos,
      removedVideos,
      externalVideos,
      activeStrikes,
    },
    recentUsers,
    recentVideos,
  };
}
