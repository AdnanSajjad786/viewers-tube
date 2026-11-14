"use client";

import { useState } from "react";

const subjects = [
  "General Enquiry",
  "Technical Support",
  "Account Issue",
  "Creator Support",
  "Business Enquiry",
  "Privacy Request",
  "Other",
];

export default function ContactForm() {
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    setSending(true);
    setStatus("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          subject: data.get("subject"),
          message: data.get("message"),
          website: data.get("website"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error || "Your message could not be sent. Please try again.");
        return;
      }

      form.reset();
      setStatus("Thank you! Your message has been sent successfully. We'll get back to you as soon as possible.");
    } catch {
      setStatus("Unable to send your message right now. Please try again later.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-7">
      <div>
        <label htmlFor="contact-name" className="mb-2 block text-sm font-medium text-slate-200">Your name</label>
        <input id="contact-name" name="name" required maxLength={80} autoComplete="name"
          placeholder="Enter your name"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-400" />
      </div>

      <div>
        <label htmlFor="contact-email" className="mb-2 block text-sm font-medium text-slate-200">Email address</label>
        <input id="contact-email" name="email" type="email" required maxLength={254} autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-400" />
      </div>

      <div>
        <label htmlFor="contact-subject" className="mb-2 block text-sm font-medium text-slate-200">Subject</label>
        <select id="contact-subject" name="subject" required defaultValue=""
          className="w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-400">
          <option value="" disabled>Select a subject</option>
          {subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
        </select>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-2 block text-sm font-medium text-slate-200">Your message</label>
        <textarea id="contact-message" name="message" required minLength={10} maxLength={5000} rows={6}
          placeholder="How can we help you?"
          className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-cyan-400" />
        <p className="mt-1 text-xs text-slate-500">Please do not include passwords or verification codes.</p>
      </div>

      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <button type="submit" disabled={sending}
        style={{ color: "#000000" }}
        className="w-full rounded-xl bg-cyan-300 px-5 py-3 font-bold transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60">
        {sending ? "Sending message..." : "Send message"}
      </button>

      {status && (
        <p role="status" aria-live="polite"
          className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-200">
          {status}
        </p>
      )}
    </form>
  );
}
