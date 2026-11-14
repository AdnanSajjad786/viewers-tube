import { prisma } from "@/lib/prisma";
import { sendModerationNotice } from "@/lib/email";

const SUSPENSION_DAYS = [7, 14, 30] as const;

export const MODERATION_POLICY_CODES = [
  "NUDITY",
  "PROFANITY",
  "HATE_HARASSMENT",
  "VIOLENCE",
  "ILLEGAL_CONTENT",
  "COPYRIGHT",
  "SCAM_IMPERSONATION",
  "SPAM",
  "OTHER",
] as const;

export async function issueConfirmedCreatorStrike(input: {
  userId: string;
  videoId?: string;
  policyCode: string;
  reason: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    // Serialize strike issuance for this account to prevent duplicate numbering.
    const locked = await tx.$queryRaw<Array<{
      id: string;
      role: string;
      creatorSuspendedUntil: Date | null;
      creatorTerminatedAt: Date | null;
    }>>`
      SELECT "id", "role", "creatorSuspendedUntil", "creatorTerminatedAt"
      FROM "User"
      WHERE "id" = ${input.userId}
      FOR UPDATE
    `;

    const target = locked[0];
    if (!target) throw new Error("CREATOR_NOT_FOUND");
    if (target.role === "ADMIN") throw new Error("ADMIN_EXEMPT");
    if (target.role !== "CREATOR") throw new Error("NOT_A_CREATOR");
    if (target.creatorTerminatedAt) throw new Error("CREATOR_TERMINATED");

    if (input.videoId) {
      const video = await tx.video.findFirst({
        where: {
          id: input.videoId,
          channel: { is: { userId: input.userId } },
        },
        select: { id: true },
      });
      if (!video) throw new Error("VIDEO_NOT_OWNED_BY_CREATOR");
    }

    const previousStrikes = await tx.moderationStrike.count({
      where: { userId: input.userId, status: "ACTIVE" },
    });

    const strikeNumber = previousStrikes + 1;
    if (strikeNumber > 4) throw new Error("CREATOR_ALREADY_TERMINATED");

    const now = new Date();
    const terminated = strikeNumber === 4;
    const suspensionDays = terminated ? 0 : SUSPENSION_DAYS[strikeNumber - 1];

    let suspensionEndsAt: Date | null = null;
    if (!terminated) {
      const base =
        target.creatorSuspendedUntil && target.creatorSuspendedUntil > now
          ? target.creatorSuspendedUntil
          : now;
      suspensionEndsAt = new Date(
        base.getTime() + suspensionDays * 24 * 60 * 60 * 1000
      );
    }

    const strike = await tx.moderationStrike.create({
      data: {
        userId: input.userId,
        videoId: input.videoId || null,
        strikeNumber,
        policyCode: input.policyCode,
        reason: input.reason,
        suspensionDays,
        issuedAt: now,
        suspensionEndsAt,
      },
    });

    if (input.videoId) {
      await tx.video.update({
        where: { id: input.videoId },
        data: {
          status: "REMOVED",
          visibility: "PRIVATE",
          removedAt: now,
          removalReason: input.reason,
        },
      });
    }

    await tx.user.update({
      where: { id: input.userId },
      data: terminated
        ? {
            creatorTerminatedAt: now,
            creatorSuspendedUntil: null,
          }
        : { creatorSuspendedUntil: suspensionEndsAt },
    });

    if (terminated) {
      // Revoke existing login sessions while retaining the account and audit trail.
      await tx.session.deleteMany({ where: { userId: input.userId } });
    }

    const account = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { email: true },
    });

    return {
      strike,
      email: account.email,
      terminated,
      suspensionDays,
      suspensionEndsAt,
    };
  });

  let notificationSent = false;
  try {
    await sendModerationNotice(result.email, {
      strikeNumber: result.strike.strikeNumber,
      reason: input.reason,
      suspensionDays: result.suspensionDays,
      suspensionEndsAt: result.suspensionEndsAt,
      terminated: result.terminated,
      appealInstructions:
        "You may submit an appeal through your Viewers Tube Creator account. " +
        "An Administrator will review it. An appeal does not automatically reverse a strike.",
    });

    await prisma.moderationStrike.update({
      where: { id: result.strike.id },
      data: { notificationSentAt: new Date() },
    });
    notificationSent = true;
  } catch (error) {
    console.error("Moderation notice delivery failed:", error);
  }

  return {
    strikeId: result.strike.id,
    strikeNumber: result.strike.strikeNumber,
    suspensionDays: result.suspensionDays,
    suspensionEndsAt: result.suspensionEndsAt,
    terminated: result.terminated,
    notificationSent,
  };
}
