import { isSameOriginRequest } from "@/lib/request-origin";

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createB2Client } from "@/lib/b2-client";

export const dynamic = "force-dynamic";

function diagnose(error: unknown) {
  const e = error as {
    name?: string;
    code?: string;
    Code?: string;
    message?: string;
    $metadata?: { httpStatusCode?: number };
  };

  const code = String(e?.Code ?? e?.code ?? e?.name ?? e?.message ?? "");
  const http = e?.$metadata?.httpStatusCode;

  if (
    [
      "STORAGE_ENCRYPTION_KEY_MISSING",
      "STORAGE_ENCRYPTION_KEY_INVALID",
      "STORAGE_SECRET_FORMAT_INVALID",
    ].includes(code)
  ) {
    return {
      cause: "ENCRYPTION_CONFIGURATION",
      message: "Server storage encryption configuration is missing or invalid. Check STORAGE_CREDENTIALS_ENCRYPTION_KEY.",
    };
  }

  if (
    [
      "InvalidAccessKeyId",
      "SignatureDoesNotMatch",
      "AccessDenied",
      "ExpiredToken",
      "Unauthorized",
    ].includes(code) || http === 403
  ) {
    return {
      cause: "CREDENTIALS_OR_PERMISSIONS",
      message: "B2 rejected the request. Check the saved application key and its bucket-list permissions.",
    };
  }

  if (
    ["NoSuchBucket", "NotFound"].includes(code) || http === 404
  ) {
    return {
      cause: "BUCKET_OR_ENDPOINT",
      message: "B2 could not find the configured bucket. Check the bucket name and region.",
    };
  }

  if (
    [
      "ENOTFOUND",
      "EAI_AGAIN",
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "NetworkingError",
      "TimeoutError",
    ].includes(code)
  ) {
    return {
      cause: "NETWORK",
      message: "The B2 endpoint could not be reached. Check network connectivity and the configured endpoint.",
    };
  }

  return {
    cause: "UNKNOWN",
    message: "Storage verification failed for an unclassified reason. Check server configuration and connectivity.",
  };
}


export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in required." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json(
        { error: "Admin or Creator access required." },
        { status: 403 }
      );
    }

    const connections = await prisma.storageConnection.findMany({
      where: user.role === "ADMIN" ? {} : { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        label: true,
        region: true,
        bucketName: true,
        prefix: true,
        status: true,
        verifiedAt: true,
      },
    });

    return NextResponse.json(
      { connections },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    console.error("[repair-centre] Storage connection listing failed.");

    return NextResponse.json(
      { error: "Could not load storage connections." },
      { status: 503 }
    );
  }
}

export async function POST(request: NextRequest) {
  let connectionId = "";

  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403 }
      );
    }

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Sign in required." },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        creatorSuspendedUntil: true,
        creatorTerminatedAt: true,
      },
    });

    if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
      return NextResponse.json(
        { error: "Admin or Creator access required." },
        { status: 403 }
      );
    }

    if (
      user.role === "CREATOR" &&
      (
        user.creatorTerminatedAt ||
        (
          user.creatorSuspendedUntil &&
          user.creatorSuspendedUntil > new Date()
        )
      )
    ) {
      return NextResponse.json(
        { error: "Creator account is restricted." },
        { status: 403 }
      );
    }


    const body = await request.json().catch(() => null);

    connectionId =
      body && typeof body.connectionId === "string"
        ? body.connectionId.trim()
        : "";

    if (!connectionId || connectionId.length > 128) {
      return NextResponse.json(
        { error: "A valid connection ID is required." },
        { status: 400 }
      );
    }

    const connection = await prisma.storageConnection.findFirst({
      where: {
        id: connectionId,
        ...(user.role === "ADMIN" ? {} : { userId: user.id }),
      },
      select: {
        id: true,
        region: true,
        endpoint: true,
        bucketName: true,
        prefix: true,
        keyId: true,
        encryptedApplicationKey: true,
      },
    });

    if (!connection) {
      return NextResponse.json(
        { error: "Storage connection not found." },
        { status: 404 }
      );
    }

    const recentAttempt = await prisma.repairAuditEvent.findFirst({
      where: {
        action: "VERIFY_STORAGE_CONNECTION",
        targetId: connection.id,
        createdAt: {
          gte: new Date(Date.now() - 30_000),
        },
      },
      select: { id: true },
    });

    if (recentAttempt) {
      return NextResponse.json(
        {
          error: "Please wait 30 seconds before verifying this connection again.",
        },
        { status: 429 }
      );
    }

    let client: ReturnType<typeof createB2Client> | undefined;
    let failure: ReturnType<typeof diagnose> | null = null;

    try {
      client = createB2Client(connection);

      await client.send(
        new ListObjectsV2Command({
          Bucket: connection.bucketName,
          Prefix: connection.prefix
            ? `${connection.prefix}/`
            : undefined,
          MaxKeys: 1,
        })
      );
    } catch (error) {
      failure = diagnose(error);
    } finally {
      client?.destroy();
    }

    const now = new Date();

    if (failure) {
      await prisma.$transaction(async (tx) => {
        await tx.storageConnection.update({
          where: { id: connection.id },
          data: { status: "ERROR" },
        });
        await tx.repairAuditEvent.create({
          data: {
            actorUserId: user.id,
            actorRole: user.role,
            action: "VERIFY_STORAGE_CONNECTION",
            status: "FAILED",
            targetType: "STORAGE_CONNECTION",
            targetId: connection.id,
            summary: `Storage verification failed: ${failure.cause}.`,
          },
        });
      });

      return NextResponse.json(
        {
          success: false,
          cause: failure.cause,
          message: failure.message,
        },
        { status: 422 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.storageConnection.update({
        where: { id: connection.id },
        data: {
          status: "VERIFIED",
          verifiedAt: now,
        },
      });
      await tx.repairAuditEvent.create({
        data: {
          actorUserId: user.id,
          actorRole: user.role,
          action: "VERIFY_STORAGE_CONNECTION",
          status: "VERIFIED",
          targetType: "STORAGE_CONNECTION",
          targetId: connection.id,
          summary: "Saved B2 credentials and bucket access verified successfully.",
        },
      });
    });

    return NextResponse.json({
      success: true,
      cause: "NONE",
      message: "Storage connection verified. Saved credentials and bucket access are working.",
      verifiedAt: now.toISOString(),
    });
  } catch (error) {
    const e = error as { name?: string; code?: string; message?: string; errors?: unknown[]; cause?: unknown };
    const details = [e?.code, e?.name, e?.message].filter(Boolean).join(" | ");
    const nested = Array.isArray(e?.errors) ? e.errors : [];
    const nestedDetails = nested.map((item) => {
      const itemError = item as { code?: string; message?: string };
      return [itemError?.code, itemError?.message].filter(Boolean).join(" ");
    }).join(" | ");
    const diagnostic = `${details} | ${nestedDetails}`.toLowerCase();
    const databaseUnavailable =
      /etimedout|enetunreach|econnreset|econnrefused|eai_again|p1001|p1002|p1017|websocket|neon/.test(diagnostic);

    console.error("[repair-centre] Storage verification request failed.", {
      name: e?.name,
      code: e?.code,
      message: e?.message,
      nested: nestedDetails || undefined,
    });

    return NextResponse.json(
      {
        success: false,
        cause: databaseUnavailable ? "DATABASE_CONNECTIVITY" : "VERIFICATION_RESULT_NOT_SAVED",
        error: databaseUnavailable
          ? "The B2 check could not be reliably recorded because the database connection failed. This does not prove that B2 storage is broken. Please retry when the database connection is stable."
          : "The verification result could not be saved. The storage connection has not been marked as failed.",
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
