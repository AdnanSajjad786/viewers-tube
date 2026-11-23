"use client";

import { useCallback, useEffect, useState } from "react";

type Ad = {
  id: string;
  title: string;
  status: string;
  creativeUrl: string | null;
  creativeStorageKey: string | null;
  destinationUrl: string | null;
};

type Campaign = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  status: string;
  budgetMinor: number | null;
  currency: string;
  ads: Ad[];
  owner?: { displayName: string; username: string };
};

type AccessRequest = {
  id: string;
  status: string;
  message: string | null;
  reviewerNote: string | null;
  applicant?: { displayName: string; username: string; email: string };
};

type Data = {
  role: string;
  accessRequest?: AccessRequest | null;
  accessRequests?: AccessRequest[];
  campaigns: Campaign[];
};

const panel = "rounded-xl border border-white/10 bg-[#0b1322] p-4";
const field = "w-full rounded-lg border border-white/10 bg-[#090f1d] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan-300/60";
const button = "rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50";

export function StudioPromotionsPanel({ role }: { role: string }) {
  const isAdmin = role === "ADMIN";
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Education");
  const [tags, setTags] = useState("");
  const [budget, setBudget] = useState("");
  const [adCampaign, setAdCampaign] = useState("");
  const [adTitle, setAdTitle] = useState("");
  const [creativeUrl, setCreativeUrl] = useState("");
  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [destinationUrl, setDestinationUrl] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/studio/promotions", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load Promotions.");
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Promotions.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional initial data fetch on mount.
  useEffect(() => { void load(); }, [load]);

  async function send(action: string, values: Record<string, unknown>, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/studio/promotions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...values }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed.");
      setMessage("Saved successfully.");
      await load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function createCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const ok = await send("create-campaign", {
      title, description, category,
      tags: tags.split(",").map(x => x.trim()).filter(Boolean),
      budgetMinor: budget.trim() ? Math.round(Number(budget) * 100) : null,
    });
    if (ok) {
      setTitle(""); setDescription(""); setTags(""); setBudget("");
    }
  }

  async function createAd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      let creativeUploadId: string | undefined;

      if (creativeFile) {
        const initResponse = await fetch("/api/studio/promotions/ads/upload/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: creativeFile.type,
            size: creativeFile.size,
          }),
        });
        const init = await initResponse.json();
        if (!initResponse.ok) throw new Error(init.error || "Could not start image upload.");

        const uploadResponse = await fetch(init.uploadUrl, {
          method: "PUT",
          headers: init.requiredHeaders,
          body: creativeFile,
        });
        if (!uploadResponse.ok) throw new Error("Image upload to storage failed.");

        const completeResponse = await fetch("/api/studio/promotions/ads/upload/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: init.uploadId }),
        });
        const complete = await completeResponse.json();
        if (!completeResponse.ok) throw new Error(complete.error || "Image verification failed.");
        creativeUploadId = init.uploadId;
      }

      const response = await fetch("/api/studio/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-ad",
          campaignId: adCampaign,
          title: adTitle,
          creativeUrl: creativeFile ? "" : creativeUrl,
          creativeUploadId,
          destinationUrl,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not submit ad creative.");

      setMessage("Ad creative submitted successfully for administrator review.");
      setAdTitle("");
      setCreativeUrl("");
      setCreativeFile(null);
      setDestinationUrl("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit ad creative.");
    } finally {
      setBusy(false);
    }
  }

  async function review(action: string, id: string, status: string) {
    await send(action, { id, status }, "PATCH");
  }

  if (loading) return <div className={panel}><p className="text-sm text-slate-400">Loading Promotions…</p></div>;

  return (
    <div className="space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Promotions</h2>
          <p className="mt-1 text-sm text-slate-400">Manage sponsored campaigns and placements inside ViewersTube Studio.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10">Refresh</button>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
      {message && <p role="status" className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">{message}</p>}

      <div className={panel}>
        <h3 className="font-semibold">How Promotions works</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          <li>Creators request access; an administrator must approve it.</li>
          <li>Campaigns and ad creatives go through administrator review before serving.</li>
          <li>Approved creators have no ViewersTube creator fee.</li>
          <li>Campaign approval here does not mean ads are already serving. Revive delivery is connected separately.</li>
        </ul>
      </div>

      {!isAdmin && (
        <section className={panel}>
          <h3 className="font-semibold">Creator access</h3>
          <p className="mt-1 text-sm text-slate-400">Request permission to create and manage promotional campaigns.</p>
          <p className="mt-3 text-sm">Current status: <strong className="text-cyan-200">{data?.accessRequest?.status || "NOT REQUESTED"}</strong></p>
          {data?.accessRequest?.reviewerNote && <p className="mt-2 text-sm text-slate-400">Administrator note: {data.accessRequest.reviewerNote}</p>}
          {data?.accessRequest?.status !== "PENDING" && data?.accessRequest?.status !== "APPROVED" && data?.accessRequest?.status !== "SUSPENDED" && (
            <form className="mt-3 space-y-3" onSubmit={async e => {
              e.preventDefault();
              const ok = await send("request-access", { message: requestMessage });
              if (ok) setRequestMessage("");
            }}>
              <textarea className={field} rows={3} maxLength={1000} value={requestMessage} onChange={e => setRequestMessage(e.target.value)} placeholder="Tell the administrator what you plan to promote (optional)." />
              <button className={button} disabled={busy}>Request Promotions access</button>
            </form>
          )}
        </section>
      )}

      {isAdmin && (
        <section className={panel}>
          <h3 className="font-semibold">Creator access requests</h3>
          <div className="mt-3 space-y-3">
            {(data?.accessRequests || []).filter(x => x.status === "PENDING").length === 0 && <p className="text-sm text-slate-400">No pending access requests.</p>}
            {(data?.accessRequests || []).filter(x => x.status === "PENDING").map(item => (
              <div key={item.id} className="rounded-lg border border-white/10 p-3">
                <p className="font-medium">{item.applicant?.displayName} <span className="text-xs text-slate-400">@{item.applicant?.username}</span></p>
                <p className="text-xs text-slate-400">{item.applicant?.email}</p>
                {item.message && <p className="mt-2 text-sm text-slate-300">{item.message}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className={button} disabled={busy} onClick={() => void review("review-access", item.id, "APPROVED")}>Approve creator</button>
                  <button className="rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300" disabled={busy} onClick={() => void review("review-access", item.id, "REJECTED")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(isAdmin || data?.accessRequest?.status === "APPROVED") && (
        <>
          <section className={panel}>
            <h3 className="font-semibold">Create a campaign</h3>
            <form onSubmit={createCampaign} className="mt-3 grid gap-3 md:grid-cols-2">
              <input className={field} required minLength={3} maxLength={160} value={title} onChange={e => setTitle(e.target.value)} placeholder="Campaign name" />
              <select className={field} value={category} onChange={e => setCategory(e.target.value)}>
                {["Education","Entertainment","Technology","Gaming","Music","Sports","Lifestyle","News","Travel","Business","Other"].map(x => <option key={x}>{x}</option>)}
              </select>
              <textarea className={`${field} md:col-span-2`} rows={3} maxLength={3000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Campaign description" />
              <input className={field} value={tags} onChange={e => setTags(e.target.value)} placeholder="Hashtags / tags, comma separated" />
              <input className={field} type="number" min="0" step="0.01" value={budget} onChange={e => setBudget(e.target.value)} placeholder="Budget in PKR (optional)" />
              <button className={button} disabled={busy}>Save draft campaign</button>
            </form>
          </section>

          <section className={panel}>
            <h3 className="font-semibold">Submit an ad creative</h3>
            <p className="mt-1 text-xs text-slate-400">Choose one of your campaigns. Creative approval is required before delivery.</p>
            <form onSubmit={createAd} className="mt-3 grid gap-3 md:grid-cols-2">
              <select className={field} required value={adCampaign} onChange={e => setAdCampaign(e.target.value)}>
                <option value="">Select campaign</option>
                {(data?.campaigns || []).filter(c => c.status !== "REJECTED" && c.status !== "ARCHIVED").map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <input className={field} required value={adTitle} onChange={e => setAdTitle(e.target.value)} placeholder="Ad title" />
              <div className="space-y-2">
                <label className="block text-xs text-slate-300">Upload image from your computer (JPEG, PNG, WebP, GIF or AVIF; max 10 MB)</label>
                <input
                  className={field}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  onChange={e => setCreativeFile(e.target.files?.[0] || null)}
                />
                {creativeFile && <p className="text-xs text-emerald-300">Selected: {creativeFile.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-slate-300">Or use an external image URL</label>
                <input
                  className={field}
                  type="url"
                  value={creativeUrl}
                  onChange={e => setCreativeUrl(e.target.value)}
                  placeholder="https://example.com/advertisement.jpg"
                  disabled={!!creativeFile}
                />
              </div>
              <input className={field} required type="url" value={destinationUrl} onChange={e => setDestinationUrl(e.target.value)} placeholder="Destination URL" />
              <button className={button} disabled={busy || !adCampaign}>Submit creative for review</button>
            </form>
          </section>
        </>
      )}

      <section className={panel}>
        <h3 className="font-semibold">{isAdmin ? "All campaigns" : "Your campaigns"}</h3>
        <div className="mt-3 space-y-3">
          {(data?.campaigns || []).length === 0 && <p className="text-sm text-slate-400">No campaigns yet.</p>}
          {(data?.campaigns || []).map(campaign => (
            <div key={campaign.id} className="rounded-lg border border-white/10 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{campaign.title}</p>
                  {isAdmin && <p className="text-xs text-slate-400">{campaign.owner?.displayName} (@{campaign.owner?.username})</p>}
                  <p className="mt-1 text-xs text-slate-400">{campaign.category || "Uncategorized"} · {campaign.currency} · Creator fee: 0</p>
                </div>
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-cyan-200">{campaign.status}</span>
              </div>
              {campaign.description && <p className="mt-2 text-sm text-slate-300">{campaign.description}</p>}
              {campaign.tags.length > 0 && <p className="mt-2 text-xs text-slate-400">{campaign.tags.map(t => `#${t}`).join(" ")}</p>}
              {campaign.budgetMinor !== null && <p className="mt-2 text-xs text-slate-400">Budget: {(campaign.budgetMinor / 100).toFixed(2)} {campaign.currency}</p>}
              {campaign.status === "DRAFT" || campaign.status === "REJECTED" ? (
                <button className={`${button} mt-3`} disabled={busy} onClick={() => void send("submit-campaign", { campaignId: campaign.id })}>Submit campaign for review</button>
              ) : null}
              <div className="mt-3 space-y-2">
                {campaign.ads.map(ad => (
                  <div key={ad.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white/[0.035] p-2 text-sm">
                    <span>{ad.title}</span><span className="text-xs text-slate-400">{ad.status}</span>
                  </div>
                ))}
              </div>
              {isAdmin && campaign.status === "PENDING_REVIEW" && (
                <div className="mt-3 flex gap-2">
                  <button className={button} disabled={busy} onClick={() => void review("review-campaign", campaign.id, "APPROVED")}>Approve campaign</button>
                  <button className="rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300" disabled={busy} onClick={() => void review("review-campaign", campaign.id, "REJECTED")}>Reject</button>
                </div>
              )}
              {isAdmin && campaign.ads.filter(a => a.status === "PENDING_REVIEW").map(ad => (
                <div key={ad.id} className="mt-3 rounded-md border border-amber-300/20 p-3">
                  <p className="text-sm font-medium">Ad review: {ad.title}</p>
                  {(ad.creativeStorageKey || ad.creativeUrl) ? (
                    <div className="mt-3">
                      <p className="mb-2 text-xs text-slate-400">Submitted creative</p>
                      <a
                        href={ad.creativeStorageKey ? `/api/studio/promotions/ads/${ad.id}/creative` : (ad.creativeUrl || "#")}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={ad.creativeStorageKey ? `/api/studio/promotions/ads/${ad.id}/creative` : (ad.creativeUrl || "")}
                          alt={`Advertisement creative: ${ad.title}`}
                          className="max-h-64 max-w-full rounded-lg border border-white/10 object-contain"
                        />
                      </a>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-amber-300">No creative image submitted.</p>
                  )}
                  <div className="mt-3 text-sm">
                    <span className="text-slate-400">Destination: </span>
                    {ad.destinationUrl ? (
                      <a href={ad.destinationUrl} target="_blank" rel="noopener noreferrer" className="break-all text-cyan-300 underline">
                        {ad.destinationUrl}
                      </a>
                    ) : (
                      <span className="text-amber-300">No destination URL submitted.</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className={button} disabled={busy} onClick={() => void review("review-ad", ad.id, "APPROVED")}>Approve ad</button>
                    <button className="rounded-lg border border-red-400/30 px-4 py-2 text-sm text-red-300" disabled={busy} onClick={() => void review("review-ad", ad.id, "REJECTED")}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {isAdmin && (
        <section className={panel}>
          <h3 className="font-semibold">Ad placements</h3>
          <p className="mt-1 text-sm text-slate-400">No placements are configured yet. Revive publisher and zone mapping will be added after the secure Revive connection is authenticated.</p>
          {(data?.campaigns || []).length >= 0 && <p className="mt-2 text-xs text-slate-500">Placement controls are intentionally unavailable until Revive connectivity is verified.</p>}
        </section>
      )}
    </div>
  );
}
