import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-protection";

const allowedLanguages = ["en", "ar"];
const translateUrl = "http://127.0.0.1:5001/translate";

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request.headers, "translation", 10);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many translation requests." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } }
    );
  }

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > 25000) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  try {
    const body: unknown = await request.json();

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const data = body as { items?: unknown; targetLanguage?: unknown };
    const target = typeof data.targetLanguage === "string"
      ? data.targetLanguage
      : "en";

    if (!allowedLanguages.includes(target)) {
      return NextResponse.json({ error: "Unsupported target language." }, { status: 400 });
    }

    if (!Array.isArray(data.items) || data.items.length > 36) {
      return NextResponse.json({ error: "Invalid translation items." }, { status: 400 });
    }

    const items: Array<{ id: string; text: string }> = [];

    for (const item of data.items) {
      if (!item || typeof item !== "object") {
        return NextResponse.json({ error: "Invalid item." }, { status: 400 });
      }

      const entry = item as { id?: unknown; text?: unknown };

      if (
        typeof entry.id !== "string" ||
        !entry.id.trim() ||
        entry.id.length > 100 ||
        typeof entry.text !== "string" ||
        !entry.text.trim() ||
        entry.text.length > 500
      ) {
        return NextResponse.json({ error: "Invalid translation text or ID." }, { status: 400 });
      }

      items.push({ id: entry.id, text: entry.text });
    }

    const translations: Record<string, string> = {};
    let failedCount = 0;

    for (let i = 0; i < items.length; i += 4) {
      const batch = items.slice(i, i + 4);

      await Promise.all(batch.map(async (item) => {
        if (target === "en") {
          translations[item.id] = item.text;
          return;
        }

        try {
          const response = await fetch(translateUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            body: JSON.stringify({
              q: item.text,
              source: "auto",
              target,
              format: "text",
            }),
            signal: AbortSignal.timeout(30000),
          });

          if (!response.ok) {
            failedCount++;
            return;
          }

          const result = await response.json();

          if (
            typeof result.translatedText === "string" &&
            result.translatedText.trim()
          ) {
            translations[item.id] = result.translatedText;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }));
    }

    return NextResponse.json({
      translations,
      translatedCount: Object.keys(translations).length,
      failedCount,
    });
  } catch {
    return NextResponse.json(
      { error: "Translation request failed." },
      { status: 500 }
    );
  }
}
