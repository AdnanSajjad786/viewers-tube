import { createB2ClientFromCredentials } from "@/lib/b2-client";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptStorageSecret } from "@/lib/storage-crypto";


const REGIONS = new Set([
  "us-west-001",
  "us-west-002",
  "us-west-004",
  "us-east-005",
  "eu-central-003",
]);

async function currentAccount() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      role: true,
      creatorSuspendedUntil: true,
      creatorTerminatedAt: true,
    },
  });

  if (!user || !["ADMIN", "CREATOR"].includes(user.role)) return null;
  if (user.role === "CREATOR" && user.creatorTerminatedAt) return null;
  if (
    user.role === "CREATOR" &&
    user.creatorSuspendedUntil &&
    user.creatorSuspendedUntil > new Date()
  ) return null;

  return user;
}

export async function GET() {
  try {
    const user = await currentAccount();
    if (!user) {
      return NextResponse.json({ error: "Creator or admin access required." }, { status: 403 });
    }

    const connections = await prisma.storageConnection.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: {
        id: true,
        label: true,
        provider: true,
        region: true,
        bucketName: true,
        prefix: true,
        status: true,
        isDefault: true,
        verifiedAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      connections,
      connection: connections[0] ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Unable to load storage connection." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentAccount();
    if (!user) {
      return NextResponse.json({ error: "Creator or admin access required." }, { status: 403 });
    }

    const body: unknown = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;
    const region = typeof data.region === "string" ? data.region : "";
    const bucketName = typeof data.bucketName === "string" ? data.bucketName.trim() : "";
    const keyId = typeof data.keyId === "string" ? data.keyId.trim() : "";
    const applicationKey = typeof data.applicationKey === "string" ? data.applicationKey.trim() : "";
    const prefixInput = typeof data.prefix === "string" ? data.prefix.trim() : "viewers-tube";
    const prefix = prefixInput.replace(/^\/+|\/+$/g, "");

    if (!REGIONS.has(region)) {
      return NextResponse.json({ error: "Unsupported Backblaze region." }, { status: 400 });
    }
    if (!/^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/.test(bucketName)) {
      return NextResponse.json({ error: "Enter a valid B2 bucket name." }, { status: 400 });
    }
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(keyId) || applicationKey.length < 20 || applicationKey.length > 200) {
      return NextResponse.json({ error: "Check your B2 Key ID and Application Key." }, { status: 400 });
    }
    if (prefix.length > 180 || prefix.split("/").some(part => !part || part === "." || part === "..")) {
      return NextResponse.json({ error: "Invalid storage folder prefix." }, { status: 400 });
    }

    const endpoint = `https://s3.${region}.backblazeb2.com`;
    const client = createB2ClientFromCredentials({
      region,
      endpoint,
      keyId,
      applicationKey,
    });

    try {
      await client.send(new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix ? `${prefix}/` : undefined,
        MaxKeys: 1,
      }));
    } catch (error: unknown) {
      const b2Error = error as {
        name?: string;
        message?: string;
        Code?: string;
        code?: string;
        $metadata?: {
          httpStatusCode?: number;
          requestId?: string;
        };
      };

      console.error("Backblaze verification diagnostic:", {
        name: b2Error.name,
        code: b2Error.Code ?? b2Error.code,
        message: b2Error.message,
        httpStatusCode: b2Error.$metadata?.httpStatusCode,
        requestId: b2Error.$metadata?.requestId,
      });

      return NextResponse.json({
        error: "Backblaze verification failed. Check the development terminal for diagnostic details.",
      }, { status: 400 });
    } finally {
      client.destroy();
    }

    const encryptedApplicationKey = encryptStorageSecret(applicationKey);
    const label = typeof data.label === "string"
      ? data.label.trim().slice(0, 80)
      : "";

    const existingCount = await prisma.storageConnection.count({
      where: { userId: user.id },
    });
    const makeDefault = data.isDefault === true || existingCount === 0;

    if (makeDefault) {
      await prisma.storageConnection.updateMany({
        where: { userId: user.id },
        data: { isDefault: false },
      });
    }

    const connection = await prisma.storageConnection.create({
      data: {
        userId: user.id,
        label: label || bucketName,
        region,
        bucketName,
        endpoint,
        keyId,
        encryptedApplicationKey,
        prefix,
        isDefault: makeDefault,
        status: "VERIFIED",
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        label: true,
        region: true,
        bucketName: true,
        prefix: true,
        status: true,
        isDefault: true,
        verifiedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Backblaze bucket verified and securely connected.",
      connection,
    });
  } catch (error) {
    console.error("Storage connection error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Unable to save storage connection." }, { status: 500 });
  }
}
