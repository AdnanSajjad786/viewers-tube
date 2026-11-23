"use client";

import { useEffect, useState } from "react";

type Termination = {
  id: string;
  reason: string;
  evidenceReference: string | null;
  status: "NOT_APPEALED" | "OPEN" | "APPROVED" | "REJECTED";
  terminatedAt: string;
  appealedAt: string | null;
  appealMessage: string | null;
  reviewedAt: string | null;
  reviewerNote: string | null;
};

export default function TerminationAppealForm() {
  const [termination, setTermination] = useState<Termination | null>(null);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/creator/termination-appeal", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load termination details.");
        if (active) setTermination(data.termination || null);
      })
      .catch((error: unknown) => {
        if (active) setNotice(error instanceof Error ? error.message : "Could not load details.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function submitAppeal() {
    setNotice("");
    if (message.trim().length < 20) {
      setNotice("Please provide at least 20 characters explaining your appeal.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/creator/termination-appeal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Appeal submission failed.");
      setNotice("Your appeal has been submitted for Admin review.");
      setTermination((current) => current ? {
        ...current,
        status: "OPEN",
        appealedAt: new Date().toISOString(),
        appealMessage: message.trim(),
      } : current);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Appeal submission failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="text-sm text-white/60">Loading termination details…</p>;
  if (!termination) return <p className="rounded-xl border border-white/10 p-4 text-sm">No direct Creator termination record was found. For a strike-based termination, use the existing strike appeal section on your Account page.</p>;

  const statusLabel = {
    NOT_APPEALED: "Appeal not submitted",
    OPEN: "Appeal awaiting Admin review",
    APPROVED: "Appeal approved",
    REJECTED: "Appeal rejected",
  }[termination.status];

  return (
    <section className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
      <div>
        <p className="text-sm text-white/60">Current appeal status</p>
        <h2 className="mt-1 text-xl font-semibold">{statusLabel}</h2>
      </div>
      <div className="space-y-2 text-sm">
        <p><strong>Termination date:</strong> {new Date(termination.terminatedAt).toLocaleString()}</p>
        <p><strong>Reason:</strong> {termination.reason}</p>
        {termination.evidenceReference && <p><strong>Evidence reference:</strong> {termination.evidenceReference}</p>}
      </div>

      {termination.status === "NOT_APPEALED" && (
        <div className="space-y-3">
          <label htmlFor="termination-appeal-message" className="block text-sm font-medium">
            Explain why you believe this decision should be reviewed
          </label>
          <textarea
            id="termination-appeal-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            minLength={20}
            maxLength={2000}
            rows={6}
            className="w-full rounded-lg border border-white/15 bg-[#111827] px-3 py-3 text-sm"
            placeholder="Provide relevant context or information for the Admin review."
          />
          <button
            type="button"
            disabled={busy || message.trim().length < 20}
            onClick={submitAppeal}
            className="rounded-lg bg-blue-700 px-5 py-3 font-semibold disabled:opacity-50"
          >
            {busy ? "Submitting…" : "Submit appeal"}
          </button>
        </div>
      )}

      {termination.appealMessage && (
        <div className="rounded-lg border border-white/10 p-4 text-sm">
          <strong>Your submitted appeal</strong>
          <p className="mt-2 whitespace-pre-wrap">{termination.appealMessage}</p>
        </div>
      )}
      {termination.reviewerNote && (
        <div className="rounded-lg border border-white/10 p-4 text-sm">
          <strong>Admin review note</strong>
          <p className="mt-2 whitespace-pre-wrap">{termination.reviewerNote}</p>
        </div>
      )}
      {notice && <p role="status" className="text-sm text-white/75">{notice}</p>}
      <p className="text-xs text-white/50">Submitting an appeal does not automatically restore Creator access. An Admin reviews the appeal and records a decision.</p>
    </section>
  );
}
