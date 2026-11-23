"use client";
import { useEffect, useState } from "react";

type App = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  creatorApplicationSubmittedAt: string | null;
  emailVerified: boolean;
  storageConnections: { id: string; label: string | null; bucketName: string; region: string; status: string; isDefault: boolean; verifiedAt: string | null }[];
};

export default function CreatorApplicationsPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [note, setNote] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("Loading applications…");
  const [busy, setBusy] = useState("");


  useEffect(() => {
    let active = true;
    fetch("/api/admin/creator-applications")
      .then(async (r) => {
        const d = await r.json();
        if (!active) return;
        if (!r.ok) setMessage(d.error || "Could not load applications.");
        else {
          setApps(d.applications || []);
          setMessage(d.applications?.length ? "" : "No pending applications.");
        }
      })
      .catch(() => { if (active) setMessage("Could not load applications."); });
    return () => { active = false; };
  }, []);

  async function review(id: string, decision: "APPROVED" | "REJECTED") {
    setBusy(id);
    try {
      const r = await fetch(`/api/admin/creator-applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: note[id] || "" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Review failed.");
      setApps((old) => old.filter((a) => a.id !== id));
      setMessage(`Application ${decision.toLowerCase()}.`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Review failed.");
    } finally { setBusy(""); }
  }

  return <main className="mx-auto max-w-4xl p-6 text-white">
    <a href="/admin" className="text-cyan-400">← Admin dashboard</a>
    <div className="my-4 flex flex-wrap gap-3">
      <a
        href="/admin/creators/terminations"
        className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200"
      >
        Creator termination & appeals
      </a>
    </div>
    <h1 className="my-5 text-3xl font-bold">Creator applications</h1>
    {message && <p className="my-4">{message}</p>}
    {apps.map((a) => <section key={a.id} className="my-4 rounded-xl border border-white/20 p-5">
      <h2 className="font-bold">{a.displayName} (@{a.username})</h2>
      <p>{a.email}</p>
      <p className="mt-2 text-sm">Email: {a.emailVerified ? "Verified" : "Not verified"}</p>
      <div className="mt-2 text-sm">
        <p className="font-semibold">Backblaze accounts ({a.storageConnections.length})</p>
        {a.storageConnections.length ? a.storageConnections.map((account) => (
          <p key={account.id} className="text-gray-300">{account.label || account.bucketName} — {account.status}{account.isDefault ? " · Default" : ""}</p>
        )) : <p className="text-amber-300">No Backblaze account connected.</p>}
      </div>
      <p className="text-sm text-gray-400">Submitted: {a.creatorApplicationSubmittedAt ? new Date(a.creatorApplicationSubmittedAt).toLocaleString() : "Unknown"}</p>
      <textarea className="mt-3 w-full rounded bg-slate-900 p-3" rows={2}
        placeholder="Optional Admin note" value={note[a.id] || ""}
        onChange={(e) => setNote((old) => ({ ...old, [a.id]: e.target.value }))} />
      <div className="mt-3 flex gap-3">
        <button disabled={!!busy || !a.emailVerified || !a.storageConnections.some((account) => account.status === "VERIFIED")} onClick={() => void review(a.id, "APPROVED")} className="rounded bg-emerald-500 px-4 py-2 text-black">Approve</button>
        <button disabled={!!busy} onClick={() => void review(a.id, "REJECTED")} className="rounded bg-rose-500 px-4 py-2 text-white">Reject</button>
      </div>
    </section>)}
  </main>;
}
