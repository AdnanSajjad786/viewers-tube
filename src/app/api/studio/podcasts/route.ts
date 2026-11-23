import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isEligibleStudioUserById } from "@/lib/creator-access";
import { prisma } from "@/lib/prisma";

async function getCreator() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  if (!(await isEligibleStudioUserById(session.user.id))) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, role: true, emailVerified: true,
      creatorAgreementAcceptedAt: true, creatorTerminatedAt: true,
      creatorSuspendedUntil: true, channel: true,
    },
  });

  if (!user || !["ADMIN", "CREATOR"].includes(user.role)) return null;
  if (user.role === "CREATOR" && (
    !user.emailVerified || !user.creatorAgreementAcceptedAt ||
    user.creatorTerminatedAt ||
    (user.creatorSuspendedUntil && user.creatorSuspendedUntil > new Date())
  )) return null;

  return user;
}

export async function GET() {
  try {
    const user = await getCreator();
    if (!user) return NextResponse.json({ error: "Creator access required." }, { status: 403 });
    if (!user.channel) return NextResponse.json({ podcasts: [] });

    const podcasts = await prisma.podcast.findMany({
      where: { channelId: user.channel.id },
      include: {
        _count: { select: { episodes: true } },
        episodes: { orderBy: { createdAt: "desc" }, take: 30 },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({
      podcasts: podcasts.map(p => ({
        ...p,
        episodes: p.episodes.map(e => ({ ...e, sizeBytes: e.sizeBytes.toString() })),
      })),
    });
  } catch (error) {
    console.error("Podcast listing failed:", error);
    return NextResponse.json({ error: "Could not load podcasts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCreator();
    if (!user) return NextResponse.json({ error: "Creator access required." }, { status: 403 });

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const language = typeof body.language === "string" ? body.language.trim() : "en";
    const artworkUrl = typeof body.artworkUrl === "string" ? body.artworkUrl.trim() : "";
    const visibility = ["PUBLIC", "UNLISTED", "PRIVATE"].includes(body.visibility) ? body.visibility : "PUBLIC";

    if (!title || title.length > 180 || description.length > 5000 ||
        category.length > 80 || language.length > 20 ||
        artworkUrl.length > 2000) {
      return NextResponse.json({ error: "Check the podcast title and metadata." }, { status: 400 });
    }

    let channel = user.channel;
    if (!channel && user.role === "ADMIN") {
      channel = await prisma.channel.create({
        data: {
          userId: user.id,
          name: "Viewers Tube Admin",
          slug: `admin-${user.id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-16)}`,
        },
      });
    }
    if (!channel) return NextResponse.json({ error: "Your channel is not ready." }, { status: 400 });

    const base = title.toLowerCase().normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "").slice(0, 65) || "podcast";
    let slug = base;
    for (let i = 0; await prisma.podcast.findUnique({ where: { slug } }); i++) {
      slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
    }

    const podcast = await prisma.podcast.create({
      data: {
        channelId: channel.id, title, slug,
        description: description || null,
        category: category || null,
        language,
        artworkUrl: artworkUrl || null,
        explicit: body.explicit === true,
        visibility,
      },
    });

    return NextResponse.json({ podcast }, { status: 201 });
  } catch (error) {
    console.error("Podcast creation failed:", error);
    return NextResponse.json({ error: "Could not create podcast." }, { status: 500 });
  }
}
