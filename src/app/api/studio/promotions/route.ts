import { NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { auth } from "@/lib/auth";
import { isEligibleStudioUserById } from "@/lib/creator-access";
import { prisma } from "@/lib/prisma";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getActor(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  if (!(await isEligibleStudioUserById(session.user.id))) return null;

  return prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, displayName: true },
  });
}

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim().replace(/^#/, "").slice(0, 40))
    .filter(Boolean))].slice(0, 15);
}

export async function GET(request: NextRequest) {
  await connection();

  try {
    const actor = await getActor(request);
    if (!actor) return jsonError("Authentication required.", 401);
    if (actor.role !== "CREATOR" && actor.role !== "ADMIN") {
      return jsonError("Creator or administrator access required.", 403);
    }

    if (actor.role === "ADMIN") {
      const [accessRequests, campaigns, placements] = await Promise.all([
        prisma.promotionAccessRequest.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            applicant: { select: { id: true, displayName: true, username: true, email: true } },
          },
        }),
        prisma.promotionCampaign.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          include: {
            owner: { select: { id: true, displayName: true, username: true } },
            ads: { orderBy: { createdAt: "desc" } },
          },
        }),
        prisma.promotionPlacement.findMany({ orderBy: { createdAt: "desc" } }),
      ]);

      return NextResponse.json(
        { role: actor.role, accessRequests, campaigns, placements },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    const [accessRequest, campaigns] = await Promise.all([
      prisma.promotionAccessRequest.findFirst({
        where: { userId: actor.id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.promotionCampaign.findMany({
        where: { ownerId: actor.id },
        orderBy: { createdAt: "desc" },
        include: { ads: { orderBy: { createdAt: "desc" } } },
      }),
    ]);

    return NextResponse.json(
      { role: actor.role, accessRequest, campaigns },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Promotions GET failed:", error);
    return jsonError("Could not load Promotions.", 500);
  }
}

export async function POST(request: NextRequest) {
  await connection();

  try {
    const actor = await getActor(request);
    if (!actor) return jsonError("Authentication required.", 401);
    if (actor.role !== "CREATOR" && actor.role !== "ADMIN") {
      return jsonError("Creator or administrator access required.", 403);
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError("Invalid request.");

    const action = cleanText(body.action, 40);

    if (action === "request-access") {
      if (actor.role !== "CREATOR") return jsonError("Only creators need to request access.", 403);

      const existing = await prisma.promotionAccessRequest.findFirst({
        where: { userId: actor.id },
        orderBy: { createdAt: "desc" },
      });

      if (existing?.status === "PENDING") {
        return jsonError("Your access request is already pending.");
      }
      if (existing?.status === "APPROVED") {
        return jsonError("Your Promotions access is already approved.");
      }
      if (existing?.status === "SUSPENDED") {
        return jsonError("Your Promotions access is suspended. Contact an administrator.");
      }

      const accessRequest = await prisma.promotionAccessRequest.create({
        data: {
          userId: actor.id,
          message: cleanText(body.message, 1000) || null,
          status: "PENDING",
        },
      });

      return NextResponse.json({ accessRequest }, { status: 201 });
    }

    if (action === "create-campaign") {
      if (actor.role === "CREATOR") {
        const access = await prisma.promotionAccessRequest.findFirst({
          where: { userId: actor.id },
          orderBy: { createdAt: "desc" },
        });
        if (access?.status !== "APPROVED") {
          return jsonError("Administrator approval is required before creating campaigns.", 403);
        }
      }

      const title = cleanText(body.title, 160);
      if (title.length < 3) return jsonError("Campaign title must contain at least 3 characters.");

      const budget = body.budgetMinor;
      if (budget !== undefined && budget !== null &&
          (!Number.isSafeInteger(budget) || budget < 0)) {
        return jsonError("Budget must be a non-negative whole number in minor currency units.");
      }

      const campaign = await prisma.promotionCampaign.create({
        data: {
          ownerId: actor.id,
          title,
          description: cleanText(body.description, 3000) || null,
          category: cleanText(body.category, 80) || null,
          tags: cleanTags(body.tags),
          budgetMinor: typeof budget === "number" ? budget : null,
          currency: "PKR",
          creatorFeeMinor: 0,
          status: "DRAFT",
        },
      });

      return NextResponse.json({ campaign }, { status: 201 });
    }

    if (action === "submit-campaign") {
      const id = cleanText(body.campaignId, 100);
      const campaign = await prisma.promotionCampaign.findUnique({ where: { id } });
      if (!campaign) return jsonError("Campaign not found.", 404);
      if (actor.role !== "ADMIN" && campaign.ownerId !== actor.id) {
        return jsonError("You cannot submit another creator's campaign.", 403);
      }
      if (actor.role === "CREATOR") {
        const access = await prisma.promotionAccessRequest.findFirst({
          where: { userId: actor.id },
          orderBy: { createdAt: "desc" },
        });
        if (access?.status !== "APPROVED") return jsonError("Promotions access is not approved.", 403);
      }
      if (!["DRAFT", "REJECTED"].includes(campaign.status)) {
        return jsonError("This campaign cannot be submitted in its current status.");
      }

      const updated = await prisma.promotionCampaign.update({
        where: { id },
        data: { status: "PENDING_REVIEW" },
      });
      await prisma.promotionReview.create({
        data: {
          targetType: "CAMPAIGN",
          targetId: id,
          campaignId: id,
          status: "PENDING",
        },
      });

      return NextResponse.json({ campaign: updated });
    }

    if (action === "create-ad") {
      const campaignId = cleanText(body.campaignId, 100);
      const campaign = await prisma.promotionCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign) return jsonError("Campaign not found.", 404);
      if (actor.role !== "ADMIN" && campaign.ownerId !== actor.id) {
        return jsonError("You cannot add an ad to another creator's campaign.", 403);
      }
      if (actor.role === "CREATOR") {
        const access = await prisma.promotionAccessRequest.findFirst({
          where: { userId: actor.id },
          orderBy: { createdAt: "desc" },
        });
        if (access?.status !== "APPROVED") return jsonError("Promotions access is not approved.", 403);
      }

      const title = cleanText(body.title, 160);
      const creativeUrl = cleanText(body.creativeUrl, 2000);
      const destinationUrl = cleanText(body.destinationUrl, 2000);
      const uploadId = cleanText(body.creativeUploadId, 100);

      if (!title || !destinationUrl || (!!creativeUrl === !!uploadId)) {
        return jsonError("Enter an ad title, destination URL, and exactly one creative image source.");
      }

      let finalCreativeUrl: string | null = null;
      let creativeStorageConnectionId: string | null = null;
      let creativeStorageKey: string | null = null;

      let upload: Awaited<ReturnType<typeof prisma.promotionCreativeUpload.findFirst>> = null;

      if (uploadId) {
        upload = await prisma.promotionCreativeUpload.findFirst({
          where: { id: uploadId, userId: actor.id, status: "READY" },
        });
        if (!upload) return jsonError("Verified image upload not found. Please upload the image again.", 404);

        const storage = await prisma.storageConnection.findFirst({
          where: {
            id: upload.storageConnectionId,
            userId: actor.id,
            status: "VERIFIED",
          },
          select: { id: true },
        });
        if (!storage) return jsonError("The image storage connection is no longer verified.", 403);

        creativeStorageConnectionId = upload.storageConnectionId;
        creativeStorageKey = upload.storageKey;
      } else {
        let creative: URL;
        try {
          creative = new URL(creativeUrl);
        } catch {
          return jsonError("Creative image URL must be valid.");
        }
        if (!["https:", "http:"].includes(creative.protocol)) {
          return jsonError("Only HTTP or HTTPS creative image URLs are accepted.");
        }
        finalCreativeUrl = creative.toString();
      }

      let destination: URL;
      try {
        destination = new URL(destinationUrl);
      } catch {
        return jsonError("Destination URL must be valid.");
      }
      if (!["https:", "http:"].includes(destination.protocol)) {
        return jsonError("Only HTTP or HTTPS destination URLs are accepted.");
      }

      const ad = await prisma.$transaction(async tx => {
        if (upload) {
          const claimed = await tx.promotionCreativeUpload.updateMany({
            where: { id: upload.id, userId: actor.id, status: "READY" },
            data: { status: "ATTACHED" },
          });
          if (claimed.count !== 1) throw new Error("IMAGE_UPLOAD_ALREADY_USED");
        }

        const created = await tx.promotionAd.create({
          data: {
            campaignId,
            title,
            format: "IMAGE",
            creativeUrl: finalCreativeUrl,
            creativeStorageConnectionId,
            creativeStorageKey,
            destinationUrl: destination.toString(),
            altText: cleanText(body.altText, 300) || null,
            tags: cleanTags(body.tags),
            status: "PENDING_REVIEW",
          },
        });

        await tx.promotionReview.create({
          data: {
            targetType: "AD",
            targetId: created.id,
            adId: created.id,
            status: "PENDING",
          },
        });

        return created;
      });

      return NextResponse.json({ ad }, { status: 201 });
    }

    return jsonError("Unknown Promotions action.");
  } catch (error) {
    console.error("Promotions POST failed:", error);
    return jsonError("Could not complete the Promotions request.", 500);
  }
}

export async function PATCH(request: NextRequest) {
  await connection();

  try {
    const actor = await getActor(request);
    if (!actor) return jsonError("Authentication required.", 401);
    if (actor.role !== "ADMIN") return jsonError("Administrator access required.", 403);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return jsonError("Invalid request.");

    const action = cleanText(body.action, 40);
    const id = cleanText(body.id, 100);
    const note = cleanText(body.note, 1000) || null;

    if (action === "review-access") {
      const status = cleanText(body.status, 20);
      if (!["APPROVED", "REJECTED", "SUSPENDED"].includes(status)) {
        return jsonError("Invalid access decision.");
      }
      const result = await prisma.promotionAccessRequest.update({
        where: { id },
        data: { status: status as "APPROVED" | "REJECTED" | "SUSPENDED", reviewerNote: note, reviewedById: actor.id, reviewedAt: new Date() },
      });
      return NextResponse.json({ accessRequest: result });
    }

    if (action === "review-campaign") {
      const status = cleanText(body.status, 20);
      if (!["APPROVED", "REJECTED"].includes(status)) return jsonError("Invalid campaign decision.");
      const result = await prisma.promotionCampaign.update({
        where: { id },
        data: { status: status as "APPROVED" | "REJECTED" },
      });
      await prisma.promotionReview.create({
        data: {
          targetType: "CAMPAIGN",
          targetId: id,
          campaignId: id,
          status: status as "APPROVED" | "REJECTED",
          reviewerId: actor.id,
          note,
        },
      });
      return NextResponse.json({ campaign: result });
    }

    if (action === "review-ad") {
      const status = cleanText(body.status, 20);
      if (!["APPROVED", "REJECTED"].includes(status)) return jsonError("Invalid ad decision.");
      const result = await prisma.promotionAd.update({
        where: { id },
        data: { status: status as "APPROVED" | "REJECTED" },
      });
      await prisma.promotionReview.create({
        data: {
          targetType: "AD",
          targetId: id,
          adId: id,
          status: status as "APPROVED" | "REJECTED",
          reviewerId: actor.id,
          note,
        },
      });
      return NextResponse.json({ ad: result });
    }

    return jsonError("Unknown administrator action.");
  } catch (error) {
    console.error("Promotions PATCH failed:", error);
    return jsonError("Could not update the Promotions record.", 500);
  }
}
