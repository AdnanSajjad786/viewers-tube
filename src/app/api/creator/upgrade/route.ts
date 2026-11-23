import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendCreatorApplicationSubmitted } from "@/lib/email";

const AGREEMENT_VERSION = "VIEWERS_TUBE_CREATOR_2026_02";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

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

    const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
    const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
    const dateOfBirth = typeof body.dateOfBirth === "string" ? body.dateOfBirth : "";
    const gender = typeof body.gender === "string" ? body.gender : "";
    const country = typeof body.country === "string" ? body.country.trim() : "";
    const validGenders = ["Male", "Female", "Other", "Prefer not to say"];
    const parsedDate = /^\\d{4}-\\d{2}-\\d{2}$/.test(dateOfBirth)
      ? new Date(`${dateOfBirth}T00:00:00.000Z`)
      : null;

    if (
      !firstName || firstName.length > 80 ||
      !lastName || lastName.length > 80 ||
      !parsedDate || Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== dateOfBirth ||
      parsedDate >= new Date() ||
      !validGenders.includes(gender) ||
      !country || country.length > 100
    ) {
      return NextResponse.json(
        { error: "Enter valid first name, last name, date of birth, gender, and country." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        emailVerified: true,
        role: true,
        creatorTerminatedAt: true,
        creatorApplicationStatus: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (!user.emailVerified) {
      return NextResponse.json({ error: "Verify your email first." }, { status: 403 });
    }
    if (user.role === "ADMIN") {
      return NextResponse.json({ error: "Admin accounts cannot apply." }, { status: 403 });
    }
    if (user.role === "CREATOR" || user.creatorApplicationStatus === "APPROVED") {
      return NextResponse.json({ error: "This account is already an approved Creator." }, { status: 409 });
    }
    if (user.creatorTerminatedAt) {
      return NextResponse.json({ error: "This account is not eligible to apply." }, { status: 403 });
    }
    if (user.creatorApplicationStatus === "PENDING") {
      return NextResponse.json({ error: "Your application is already awaiting review." }, { status: 409 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        role: "VIEWER",
        signupType: "CREATOR",
        firstName,
        lastName,
        dateOfBirth,
        gender,
        country,
        creatorAgreementVersion: AGREEMENT_VERSION,
        creatorAgreementAcceptedAt: new Date(),
        creatorApplicationStatus: "PENDING",
        creatorApplicationSubmittedAt: new Date(),
        creatorApplicationReviewedAt: null,
        creatorApplicationReviewedById: null,
        creatorApplicationReviewNote: null,
      },
    });

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", emailVerified: true },
      select: { email: true },
    });

    const emailResults = await Promise.allSettled(
      admins.map((admin) =>
        sendCreatorApplicationSubmitted(admin.email, {
          displayName: user.displayName,
          email: user.email,
          username: user.username,
        }),
      ),
    );

    const failures = emailResults.filter((result) => result.status === "rejected").length;
    if (failures > 0) {
      console.error(`Creator application saved; ${failures} Admin notification email(s) failed.`);
    }

    return NextResponse.json({
      success: true,
      status: "PENDING",
      message: "Your Creator application was submitted and is awaiting Admin review.",
    });
  } catch (error) {
    console.error("Creator application submission failed:", error);
    return NextResponse.json(
      { error: "Could not submit your Creator application." },
      { status: 500 },
    );
  }
}
