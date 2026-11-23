import { prisma } from "@/lib/prisma";

const TRANSIENT_CODES = new Set([
  "P1001", "P1002", "P1017",
  "ETIMEDOUT", "ECONNRESET", "ECONNREFUSED",
  "ENETUNREACH", "EHOSTUNREACH", "EAI_AGAIN",
  "ENOTFOUND", "CONNECTION_CLOSED",
  "WEBSOCKET_ERROR", "NetworkingError",
]);

function findTransientCode(error: unknown, depth = 0): string | null {
  if (!error || depth > 5) return null;

  const value = error as {
    code?: unknown;
    name?: unknown;
    cause?: unknown;
    errors?: unknown;
  };

  if (typeof value.code === "string" && TRANSIENT_CODES.has(value.code)) {
    return value.code;
  }

  if (
    typeof value.name === "string" &&
    TRANSIENT_CODES.has(value.name)
  ) {
    return value.name;
  }

  if (Array.isArray(value.errors)) {
    for (const nested of value.errors) {
      const found = findTransientCode(nested, depth + 1);
      if (found) return found;
    }
  }

  return findTransientCode(value.cause, depth + 1);
}

export async function withTransientRetry<T>(
  operation: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  const delays = [250, 750];

  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const transient = findTransientCode(error);

      if (!transient || attempt >= attempts - 1) {
        throw error;
      }

      console.warn(
        `[automatic-recovery] Temporary service failure (${transient}); retry ${attempt + 1}/${attempts - 1}.`,
      );

      await new Promise((resolve) =>
        setTimeout(resolve, delays[attempt] ?? 750),
      );
    }
  }
}

export async function recordPlatformIncident(input: {
  source: string;
  title: string;
  detail: string;
  error: unknown;
  targetId?: string | null;
  actorUserId?: string | null;
}) {
  const fingerprint =
    `${input.source}:${input.targetId || "global"}`;

  try {
    await prisma.platformIncident.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        source: input.source,
        severity: "ERROR",
        status: "OPEN",
        title: input.title,
        detail: input.detail,
        errorCode: findTransientCode(input.error) ?? "UNCLASSIFIED",
        targetType: input.targetId ? "VIDEO" : "SERVICE",
        targetId: input.targetId ?? null,
        actorUserId: input.actorUserId ?? null,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        occurrences: { increment: 1 },
        lastSeenAt: new Date(),
        detail: input.detail,
        errorCode: findTransientCode(input.error) ?? "UNCLASSIFIED",
      },
    });
  } catch (error) {
    // Local diagnostic detail: identify why incident persistence failed.
    console.error("[incident-recording] Could not persist incident:", {
      source: input.source,
      error: error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : String(error),
    });
  }
}

export async function resolvePlatformIncident(input: {
  source: string;
  targetId?: string | null;
}) {
  try {
    await prisma.platformIncident.updateMany({
      where: {
        source: input.source,
        targetId: input.targetId ?? null,
        status: "OPEN",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });
  } catch {
    console.error(
      `[incident-resolution] Could not resolve incident: ${input.source}.`,
    );
  }
}
