"use client";

import { useCallback, useEffect, useState } from "react";

type Creator = {
  id: string;
  username: string;
  displayName: string;
  email: string;
};

type ApiPayload = {
  error?: string;
  creators?: Creator[];
  appeals?: Appeal[];
  errors?: { creators?: string; appeals?: string };
  success?: boolean;
  emailSent?: boolean;
};

async function readApiPayload(response: Response): Promise<ApiPayload> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`Server returned an empty response (HTTP ${response.status}).`);
  }
  try {
    return JSON.parse(body) as ApiPayload;
  } catch {
    throw new Error(`Server returned an invalid response (HTTP ${response.status}).`);
  }
}

type Appeal = {
  id: string;
  reason: string;
  evidenceReference: string | null;
  appealMessage: string | null;
  appealedAt: string | null;
  terminatedAt: string;
  user: Creator;
};

export default function TerminationAdminPanel() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [userId, setUserId] = useState("");
  const [reason, setReason] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/moderation/terminations", {
        cache: "no-store",
      });
      const data = await readApiPayload(response);
      setCreators(data.creators || []);
      setAppeals(data.appeals || []);
      const sectionErrors = [data.errors?.creators, data.errors?.appeals].filter(Boolean);
      if (!response.ok) throw new Error(data.error || sectionErrors.join(" ") || "Could not load moderation data.");
      setMessage(sectionErrors.join(" "));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (active) void load();
    });

    return () => {
      active = false;
    };
  }, [load]);

  async function terminateCreator() {
    setMessage("");
    if (!userId || reason.trim().length < 10) {
      setMessage("Select a Creator and enter a reason of at least 10 characters.");
      return;
    }

    if (!window.confirm("Terminate this Creator account and revoke active sessions?")) return;

    setBusy(true);
    try {
      const response = await fetch("/api/admin/moderation/terminations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, reason, evidenceReference }),
      });
      const data = await readApiPayload(response);
      if (!response.ok) throw new Error(data.error || "Termination failed.");
      setMessage(data.emailSent
        ? "Creator terminated. Email notification sent."
        : "Creator terminated. Email notification could not be sent; check SMTP.");
      setUserId("");
      setReason("");
      setEvidenceReference("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Termination failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewAppeal(id: string, decision: "APPROVED" | "REJECTED") {
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/moderation/terminations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: reviewNotes[id] || "" }),
      });
      const data = await readApiPayload(response);
      if (!response.ok) throw new Error(data.error || "Appeal review failed.");
      setMessage(decision === "APPROVED"
        ? "Appeal approved. Creator access restored unless a separate fourth strike remains active."
        : "Appeal rejected. Creator termination remains in effect.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Appeal review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold">Terminate an active Creator</h2>
        <p className="mt-2 text-sm text-white/65">
          Use only after reviewing a confirmed serious violation. This action does not create a strike.
        </p>

        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm">
            Creator account
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="rounded-lg border border-white/15 bg-[#111827] px-3 py-3"
            >
              <option value="">Select an active Creator</option>
              {creators.map((creator) => (
                <option key={creator.id} value={creator.id}>
                  {creator.displayName} (@{creator.username}) — {creator.email}
                </option>
              ))}
            </select>
            {creators.length === 0 && !loading && (
              <span className="text-xs text-amber-300">
                No active Creator accounts were returned. Check the API response and database connection.
              </span>
            )}
          </label>

          <label className="grid gap-2 text-sm">
            Confirmed violation and reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={10}
              maxLength={2000}
              rows={4}
              className="rounded-lg border border-white/15 bg-[#111827] px-3 py-3"
              placeholder="Describe the confirmed violation and review basis."
            />
          </label>

          <label className="grid gap-2 text-sm">
            Evidence reference (optional)
            <input
              value={evidenceReference}
              onChange={(event) => setEvidenceReference(event.target.value)}
              maxLength={1000}
              className="rounded-lg border border-white/15 bg-[#111827] px-3 py-3"
              placeholder="Internal case ID or evidence reference"
            />
          </label>

          <button
            type="button"
            disabled={busy || !userId || reason.trim().length < 10}
            onClick={terminateCreator}
            className="rounded-lg bg-red-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Please wait…" : "Terminate Creator account"}
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Creator termination appeals</h2>
        {loading && <p className="text-sm text-white/60">Loading…</p>}
        {!loading && appeals.length === 0 && (
          <p className="rounded-xl border border-white/10 p-4 text-sm text-white/60">
            No open termination appeals.
          </p>
        )}

        {appeals.map((appeal) => (
          <article key={appeal.id} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <div>
              <h3 className="font-semibold">{appeal.user.displayName} (@{appeal.user.username})</h3>
              <p className="text-sm text-white/60">{appeal.user.email}</p>
            </div>
            <div className="text-sm">
              <p><strong>Termination reason:</strong> {appeal.reason}</p>
              {appeal.evidenceReference && <p className="mt-1"><strong>Evidence:</strong> {appeal.evidenceReference}</p>}
              <p className="mt-1"><strong>Appeal submitted:</strong> {appeal.appealedAt ? new Date(appeal.appealedAt).toLocaleString() : "Not available"}</p>
              <p className="mt-3 whitespace-pre-wrap"><strong>Creator appeal:</strong>{" "}{appeal.appealMessage || "No appeal message recorded."}</p>
            </div>
            <textarea
              value={reviewNotes[appeal.id] || ""}
              onChange={(event) => setReviewNotes((current) => ({ ...current, [appeal.id]: event.target.value }))}
              maxLength={2000}
              rows={2}
              placeholder="Admin decision note (optional)"
              className="w-full rounded-lg border border-white/15 bg-[#111827] px-3 py-3 text-sm"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => reviewAppeal(appeal.id, "APPROVED")}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Approve appeal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => reviewAppeal(appeal.id, "REJECTED")}
                className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Reject appeal
              </button>
            </div>
          </article>
        ))}
      </section>

      {message && <p role="status" className="rounded-lg border border-white/10 p-3 text-sm">{message}</p>}
    </div>
  );
}
