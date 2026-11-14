import { NextRequest, NextResponse } from "next/server";
import { sendContactMessage } from "@/lib/email";


const allowedSubjects = [
  "General Enquiry",
  "Technical Support",
  "Account Issue",
  "Creator Support",
  "Business Enquiry",
  "Privacy Request",
  "Other",
];

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json({ error: "Invalid request format." }, { status: 415 });
    }

    const raw = await request.text();
    if (raw.length > 12000) {
      return NextResponse.json({ error: "Your message is too large." }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid form submission." }, { status: 400 });
    }

    const data = body as Record<string, unknown>;

    // Basic honeypot: silently accept bot submissions without sending email.
    if (typeof data.website === "string" && data.website.trim()) {
      return NextResponse.json({ success: true });
    }

    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const subject = typeof data.subject === "string" ? data.subject : "";
    const message = typeof data.message === "string" ? data.message.trim() : "";

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Please enter a name between 2 and 80 characters." }, { status: 400 });
    }

    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
    }

    if (!allowedSubjects.includes(subject)) {
      return NextResponse.json({ error: "Please select a valid subject." }, { status: 400 });
    }

    if (message.length < 10 || message.length > 5000) {
      return NextResponse.json({ error: "Your message must be between 10 and 5000 characters." }, { status: 400 });
    }

    if (/[\r\n]/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    await sendContactMessage({ name, email, subject, message });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form email delivery failed:", error);
    return NextResponse.json(
      { error: "We couldn't send your message right now. Please try again later." },
      { status: 500 }
    );
  }
}
