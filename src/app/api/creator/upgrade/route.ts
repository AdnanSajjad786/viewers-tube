import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const AGREEMENT_VERSION = "VIEWERS_TUBE_CREATOR_2026_01";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);

    if (
      body?.acceptedAgreement !== true ||
      body?.agreementVersion !== AGREEMENT_VERSION
    ) {
      return NextResponse.json(
        { error: "You must accept the current Creator Agreement." },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          username: true,
          displayName: true,
          emailVerified: true,
          role: true,
          creatorTerminatedAt: true,
        },
      });

      if (!user) throw new Error("USER_NOT_FOUND");
      if (!user.emailVerified) throw new Error("EMAIL_NOT_VERIFIED");
      if (user.role === "ADMIN") throw new Error("ADMIN_ACCOUNT");
      if (user.role === "CREATOR") throw new Error("ALREADY_CREATOR");
      if (user.creatorTerminatedAt) throw new Error("CREATOR_TERMINATED");

      const channel = await tx.channel.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          name: user.displayName,
          slug: `${user.username}-${user.id.slice(-6)}`,
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          role: "CREATOR",
          signupType: "CREATOR",
          creatorAgreementVersion: AGREEMENT_VERSION,
          creatorAgreementAcceptedAt: new Date(),
        },
      });

      return { channelId: channel.id, channelSlug: channel.slug };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const messages: Record<string, { status: number; message: string }> = {
      USER_NOT_FOUND: { status: 404, message: "Account not found." },
      EMAIL_NOT_VERIFIED: { status: 403, message: "Verify your email first." },
      ADMIN_ACCOUNT: { status: 403, message: "Admin accounts cannot use Creator upgrade." },
      ALREADY_CREATOR: { status: 409, message: "This account is already a Creator." },
      CREATOR_TERMINATED: { status: 403, message: "This account is not eligible for Creator upgrade." },
    };

    if (error instanceof Error && messages[error.message]) {
      const item = messages[error.message];
      return NextResponse.json({ error: item.message }, { status: item.status });
    }

    console.error("Creator upgrade failed:", error);
    return NextResponse.json(
      { error: "Could not upgrade this account." },
      { status: 500 },
    );
  }
}
