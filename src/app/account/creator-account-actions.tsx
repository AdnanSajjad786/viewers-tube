"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const AGREEMENT_VERSION = "VIEWERS_TUBE_CREATOR_2026_01";

type Strike = {
  id: string;
  strikeNumber: number;
  reason: string;
  appealStatus: string | null;
};

export function CreatorAccountActions({
  mode,
  strikes,
}: {
  mode: "upgrade" | "appeals";
  strikes: Strike[];
}) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  async function upgrade() {
    setBusy("upgrade");
    setNotice("");
    try {
      const response = await fetch("/api/creator/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptedAgreement: accepted,
          agreementVersion: AGREEMENT_VERSION,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upgrade failed.");
      setNotice("Your account is now a Creator. Your channel has been created.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upgrade failed.");
    } finally {
      setBusy(null);
    }
  }

  async function submitAppeal(strikeId: string) {
    const message = (messages[strikeId] || "").trim();
    if (message.length < 20 || message.length > 2000) {
      setNotice("Appeal messages must contain 20–2000 characters.");
      return;
    }

    setBusy(strikeId);
    setNotice("");
    try {
      const response = await fetch("/api/creator/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strikeId, message }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Appeal submission failed.");
      setNotice("Your appeal was submitted successfully.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Appeal submission failed.");
    } finally {
      setBusy(null);
    }
  }

  if (mode === "upgrade") {
    return (
      <section className="mt-7 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-5">
        <h2 className="text-xl font-bold text-cyan-200">Become a Creator</h2>
        <p className="mt-2 text-sm text-slate-300">
          Upgrade this account and create your channel. You will keep the same login.
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 accent-cyan-400"
          />
          <span>
            I have read and accept the Viewers Tube Creator Agreement
            ({AGREEMENT_VERSION}). I understand the content rules, moderation
            process, strikes, and appeal policy.
          </span>
        </label>
        <button
          type="button"
          onClick={upgrade}
          disabled={!accepted || busy !== null}
          className="mt-4 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {busy === "upgrade" ? "Upgrading…" : "Upgrade to Creator"}
        </button>
        {notice && <p role="status" className="mt-3 text-sm text-cyan-200">{notice}</p>}
      </section>
    );
  }

  return (
    <section className="mt-5 space-y-3">
      <h3 className="font-semibold">Appeal a moderation strike</h3>
      {strikes.map((strike) => (
        <div key={strike.id} className="rounded-lg border border-white/10 bg-black/20 p-4">
          <p className="text-sm font-semibold">Strike {strike.strikeNumber}</p>
          <p className="mt-1 text-sm text-slate-300">{strike.reason}</p>
          {strike.appealStatus ? (
            <p className="mt-3 text-sm text-cyan-200">
              Appeal status: {strike.appealStatus}
            </p>
          ) : (
            <>
              <label
                className="mt-3 block text-xs text-slate-400"
                htmlFor={`appeal-${strike.id}`}
              >
                Explain why you believe this strike should be reviewed
                (20–2000 characters).
              </label>
              <textarea
                id={`appeal-${strike.id}`}
                value={messages[strike.id] || ""}
                onChange={(event) =>
                  setMessages((current) => ({
                    ...current,
                    [strike.id]: event.target.value,
                  }))
                }
                rows={4}
                maxLength={2000}
                className="mt-2 w-full rounded-lg border border-white/15 bg-slate-950 p-3 text-sm text-white outline-none focus:border-cyan-400"
                placeholder="Write your appeal…"
              />
              <button
                type="button"
                onClick={() => submitAppeal(strike.id)}
                disabled={busy !== null}
                className="mt-3 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {busy === strike.id ? "Submitting…" : "Submit appeal"}
              </button>
            </>
          )}
        </div>
      ))}
      {notice && <p role="status" className="text-sm text-cyan-200">{notice}</p>}
    </section>
  );
}
