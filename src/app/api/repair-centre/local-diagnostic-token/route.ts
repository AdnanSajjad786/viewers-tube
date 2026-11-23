import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedOrigins = new Set([
  "http://localhost:3001",
  "http://127.0.0.1:3001",
    "http://localhost:8787",
    "http://127.0.0.1:8787",
]);

export async function POST() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");

  if (!origin || !allowedOrigins.has(origin)) {
    return NextResponse.json({ error: "Local origin required." }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const secret = process.env.LOCAL_DIAGNOSTICS_TOKEN;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "Local diagnostic agent is not configured." }, { status: 503 });
  }

  const expires = Date.now() + 30_000;
  const message = `${expires}.${origin}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const hex = Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, "0")).join("");

  return NextResponse.json(
    { token: `${expires}.${hex}` },
    { headers: { "Cache-Control": "no-store, private" } },
  );
}
