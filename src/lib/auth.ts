import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

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
              role: isCreator ? "CREATOR" : "VIEWER",
              ...(isCreator
                ? { creatorAgreementAcceptedAt: new Date() }
                : {}),
            },
          };
        },
        after: async (user) => {
          const record = user as unknown as Record<string, unknown>;
          if (record.role !== "CREATOR") return;

          const userId = String(record.id);
          const username =
            typeof record.username === "string" ? record.username : "creator";
          const displayName =
            typeof record.name === "string" ? record.name : username;

          await prisma.channel.upsert({
            where: { userId },
            update: {},
            create: {
              userId,
              name: displayName,
              slug: `${username}-${userId.slice(-6)}`,
            },
          });
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
      if (
        signupType === "CREATOR" &&
        user.creatorAgreementVersion !== "VIEWERS_TUBE_CREATOR_2026_01"
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
