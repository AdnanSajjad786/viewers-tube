import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import {
  sendVerificationEmail,
  sendCreatorEmailVerified,
  sendAdminCreatorEmailVerified,
} from "@/lib/email";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3001",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:3001",
  ],
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const requestedType =
            (user as unknown as Record<string, unknown>).signupType;
          const isCreator = requestedType === "CREATOR";

          return {
            data: {
              ...user,
              role: "VIEWER",
              ...(isCreator
                ? {
                    creatorApplicationStatus: "PENDING",
                    creatorApplicationSubmittedAt: new Date(),
                    creatorAgreementAcceptedAt: new Date(),
                  }
                : {}),
            },
          };
        },
      },
    },
  },
  validateUserInfo: async ({
    user,
    source,
  }: {
    user: Record<string, unknown>;
    source: { action: string; method: string };
  }) => {
    if (
      source.action === "create-user" &&
      source.method === "email-password"
    ) {
      const username = user.username;
      if (
        typeof username !== "string" ||
        !/^[a-z0-9_]{3,24}$/.test(username)
      ) {
        return {
          error: "INVALID_USERNAME",
          errorDescription: "Username must be 3–24 characters using lowercase letters, numbers or underscores.",
        };
      }
      const signupType = user.signupType;
      if (
        signupType !== undefined &&
        signupType !== "VIEWER" &&
        signupType !== "CREATOR"
      ) {
        return {
          error: "INVALID_ACCOUNT_TYPE",
          errorDescription: "Please choose Viewer or Creator.",
        };
      }
      if (signupType === "CREATOR") {
        const requiredCreatorFields = ["firstName", "lastName", "dateOfBirth", "gender", "country"];
        for (const field of requiredCreatorFields) {
          if (typeof user[field] !== "string" || !(user[field] as string).trim()) {
            return {
              error: "CREATOR_PROFILE_REQUIRED",
              errorDescription: "Complete all required Creator profile fields.",
            };
          }
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(user.dateOfBirth as string)) {
          return {
            error: "INVALID_DATE_OF_BIRTH",
            errorDescription: "Enter a valid date of birth.",
          };
        }
        if (!["Male", "Female", "Other", "Prefer not to say"].includes(user.gender as string)) {
          return {
            error: "INVALID_GENDER",
            errorDescription: "Choose a valid gender option.",
          };
        }
      }
      if (
        signupType === "CREATOR" &&
        user.creatorAgreementVersion !== "VIEWERS_TUBE_CREATOR_2026_02"
      ) {
        return {
          error: "CREATOR_AGREEMENT_REQUIRED",
          errorDescription: "You must accept the current Creator Agreement.",
        };
      }
    }
  },
  emailVerification: {
    sendOnSignUp: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
    afterEmailVerification: async (verifiedUser) => {
      try {
        const applicant = await prisma.user.findUnique({
          where: { id: verifiedUser.id },
          select: {
            id: true, email: true, displayName: true,
            firstName: true, lastName: true, dateOfBirth: true,
            gender: true, username: true, country: true,
            signupType: true, creatorApplicationStatus: true,
          },
        });

        if (
          !applicant ||
          applicant.signupType !== "CREATOR" ||
          applicant.creatorApplicationStatus !== "PENDING"
        ) return;

        const notificationClaimedAt = new Date();
const claimed = await prisma.user.updateMany({
          where: {
            id: applicant.id,
            emailVerified: true,
            signupType: "CREATOR",
            creatorApplicationStatus: "PENDING",
            creatorEmailVerifiedNotifiedAt: null,
          },
          data: { creatorEmailVerifiedNotifiedAt: notificationClaimedAt },
        });
        if (claimed.count !== 1) return;

        const creatorName =
          [applicant.firstName, applicant.lastName].filter(Boolean).join(" ") ||
          applicant.displayName;

        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", emailVerified: true },
          select: { email: true },
        });

        const results = await Promise.allSettled([
          sendCreatorEmailVerified(applicant.email, creatorName),
          ...admins.map((admin) =>
            sendAdminCreatorEmailVerified(admin.email, {
              displayName: creatorName,
              firstName: applicant.firstName || "Not provided",
              lastName: applicant.lastName || "Not provided",
              dateOfBirth: applicant.dateOfBirth || "Not provided",
              gender: applicant.gender || "Not provided",
              username: applicant.username,
              email: applicant.email,
              country: applicant.country || "Not provided",
              verifiedAt: new Date(),
            })
          ),
        ]);
        if (results.some((result) => result.status === "rejected")) {
          console.error("Creator notification delivery failed; allowing retry.", results.filter((result) => result.status === "rejected"));
          await prisma.user.updateMany({
            where: { id: applicant.id, creatorEmailVerifiedNotifiedAt: notificationClaimedAt },
            data: { creatorEmailVerifiedNotifiedAt: null },
          });
        }
        const failures = results.filter((result) => result.status === "rejected").length;
        if (failures) {
          console.error(`Creator email verification notification failures: ${failures}`);
        }
      } catch (error) {
        console.error("Creator email verification notification failed:", error);
      }
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  user: {
    fields: {
      name: "displayName",
    },
    additionalFields: {
      username: {
        type: "string",
        required: true,
        input: true,
      },
      signupType: {
        type: "string",
        required: false,
        defaultValue: "VIEWER",
        input: true,
      },
      creatorAgreementVersion: {
        type: "string",
        required: false,
        input: true,
      },
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      dateOfBirth: { type: "string", required: false, input: true },
      gender: { type: "string", required: false, input: true },
      country: { type: "string", required: false, input: true },
      role: {
        type: "string",
        required: false,
        defaultValue: "VIEWER",
        input: false,
      },
    },
  },
  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),
});
