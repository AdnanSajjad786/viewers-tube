import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTransientRetry } from "@/lib/platform-incidents";
import { isSameOriginRequest } from "@/lib/request-origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Request origin not allowed." }, { status: 403 });
  }

  let session;
  try {
    const requestHeaders = await headers();
    session = await withTransientRetry(() =>
      auth.api.getSession({ headers: requestHeaders })
    );
  } catch (error) {
    console.error("[client-incident] Authentication failed:", error instanceof Error ? { name: error.name, message: error.message } : String(error));
    return NextResponse.json(
      { error: "Authentication service temporarily unavailable." },
      {
        status: 503,
        headers: { "Retry-After": "2", "Cache-Control": "no-store" },
      }
    );
  }

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    message?: unknown;
    kind?: unknown;
  } | null;

  const message = typeof body?.message === "string"
    ? body.message.trim().slice(0, 1800)
    : "";

  const kind =
    body?.kind === "unhandledrejection" ? "Unhandled promise rejection" :
    body?.kind === "fetch-http" ? "Failed API request (HTTP 5xx)" :
    body?.kind === "fetch-network" ? "Failed network request" :
    "Browser exception";

  if (!message) {
    return NextResponse.json({ error: "Missing error detail." }, { status: 400 });
  }

  // Group repeats of the same error, but keep unrelated browser failures separate.
  const normalized = `${kind}:${message}`
    .toLowerCase()
    .replace(/line\s+\d+/g, "line")
    .replace(/\s+/g, " ")
    .trim();

  const signature = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  const fingerprint = `BROWSER_CLIENT:${session.user.id}:${signature}`;

  try {
    await withTransientRetry(() => prisma.platformIncident.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        source: "BROWSER_CLIENT",
        severity: "ERROR",
        status: "OPEN",
        title: kind,
        detail: message,
        errorCode: "CLIENT_ERROR",
        targetType: "USER",
        targetId: session.user.id,
        actorUserId: session.user.id,
      },
      update: {
        status: "OPEN",
        resolvedAt: null,
        occurrences: { increment: 1 },
        lastSeenAt: new Date(),
        title: kind,
        detail: message,
        errorCode: "CLIENT_ERROR",
      },
    }));

    return NextResponse.json(
      { recorded: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[client-incident] Incident persistence failed:", error instanceof Error ? { name: error.name, message: error.message } : String(error));
    return NextResponse.json(
      { error: "Could not record browser incident." },
      {
        status: 503,
        headers: { "Retry-After": "2", "Cache-Control": "no-store" },
      }
    );
  }
}
