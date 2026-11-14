"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ChannelEditor({
  initialName,
  initialDescription,
}: {
  initialName: string;
  initialDescription: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function save() {
    setBusy(true);
    setNotice("");

    try {
      const response = await fetch("/api/my-channel", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not save channel.");
      }

      setName(result.channel.name);
      setDescription(result.channel.description || "");
      setNotice("Channel profile saved.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save channel.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
      <h3 className="font-semibold">Edit channel profile</h3>

      <label htmlFor="channel-name" className="mt-3 block text-xs text-slate-400">
        Channel name
      </label>
      <input
        id="channel-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        minLength={2}
        maxLength={80}
        className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 p-3 text-sm text-white outline-none focus:border-cyan-400"
      />

      <label htmlFor="channel-description" className="mt-3 block text-xs text-slate-400">
        Description
      </label>
      <textarea
        id="channel-description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={1000}
        rows={4}
        className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 p-3 text-sm text-white outline-none focus:border-cyan-400"
        placeholder="Tell viewers about your channel…"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || name.trim().length < 2}
          className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save channel"}
        </button>
        {notice && <p role="status" className="text-sm text-cyan-200">{notice}</p>}
      </div>
    </div>
  );
}
