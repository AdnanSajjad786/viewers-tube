"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { VideoUploadForm } from "../account/video-upload-form";
import { StudioLivePanel } from "./studio-live-panel";
import { StudioPodcastsPanel } from "./studio-podcasts-panel";
import { StudioPromotionsPanel } from "./studio-promotions-panel";

type VideoItem = {
  id: string;
  title: string;
  description: string | null;
  isShort: boolean;
  status: string;
  visibility: string;
  scheduledAt: string | null;
  scheduledVisibility: string | null;
  language: string | null;
  category: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  ownerName: string;
  channelName: string;
  storageLabel: string;
  renditionCount: number;
  commentCount: number;
  likeCount: number;
  transcodeJob: { status: string } | null;
};

const tabs = ["Videos", "Shorts", "Live", "Posts", "Playlists", "Podcasts", "Promotions", "Collaborations", "Ideas"];

export function StudioDashboard({ role, displayName }: { role: string; displayName: string }) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Videos");
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/studio/videos", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load videos.");
      setVideos(data.videos);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Studio.");
    } finally {
      setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional initial data fetch on mount.
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => videos.filter((video) => {
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [video.title, video.description, video.channelName, video.ownerName]
      .some((value) => value?.toLowerCase().includes(term));
    const matchesType = tab === "Shorts" ? video.isShort : tab === "Videos" ? !video.isShort : true;
    return matchesSearch && matchesType &&
      (visibility === "ALL" || video.visibility === visibility);
  }), [videos, search, visibility, tab]);

  async function saveVideo(event: React.FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/studio/videos/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        description: form.get("description"),
        category: form.get("category"),
        language: form.get("language"),
        visibility: form.get("visibility"),
        isShort: form.get("isShort") === "on",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error || "Could not save video.");
      return;
    }
    setExpanded(null);
    await load();
  }

  async function deleteVideo(id: string, title: string) {
    if (!window.confirm(`Permanently delete "${title}" and its files from its connected Backblaze bucket? This cannot be undone.`)) return;
    const response = await fetch(`/api/studio/videos/${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      window.alert(data.error || "Video deletion failed.");
      return;
    }
    setVideos((current) => current.filter((video) => video.id !== id));
  }

  return (
    <main className="min-h-screen bg-[#090d18] px-3 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.22em] text-cyan-300">VIEWERS TUBE / STUDIO</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{role === "ADMIN" ? "Admin Studio" : "Creator Studio"}</h1>
            <p className="mt-1 text-sm text-slate-400">Welcome, {displayName}. Your content workspace.</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link href="/" className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10">Explore</Link>
            <Link href="/account" className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10">Account</Link>
            <Link href="/repair-centre" className="rounded-lg border border-cyan-300/30 px-3 py-2 text-cyan-200 hover:bg-cyan-300/10">Repair Centre</Link>
            {role === "ADMIN" && <Link href="/admin" className="rounded-lg border border-white/15 px-3 py-2 hover:bg-white/10">Admin dashboard</Link>}
          </nav>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Total videos", videos.length],
            ["Public", videos.filter(v => v.visibility === "PUBLIC").length],
            ["Processing", videos.filter(v => v.status === "PROCESSING").length],
            ["Comments", videos.reduce((n, v) => n + v.commentCount, 0)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </section>

        <section className="mb-7 overflow-hidden rounded-2xl border border-white/10 bg-[#101727]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold">Upload content</h2>
              <p className="text-xs text-slate-400">Add details first, then upload directly to your verified Backblaze storage.</p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">Secure upload</span>
          </div>
          <div className="p-4 sm:p-5"><VideoUploadForm /></div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101727]">
          <div className="border-b border-white/10 px-4 pt-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Channel content</h2>
                <p className="mt-1 text-xs text-slate-400">{role === "ADMIN" ? "Manage platform uploads" : "Manage your channel uploads"}</p>
              </div>
              <button onClick={() => void load()} className="rounded-lg border border-white/15 px-3 py-2 text-sm hover:bg-white/10">↻ Refresh</button>
            </div>
            <div className="mt-4 flex gap-5 overflow-x-auto">
              {tabs.map((name) => (
                <button key={name} onClick={() => setTab(name)} className={`shrink-0 border-b-2 px-1 pb-3 text-sm ${tab === name ? "border-cyan-300 font-semibold text-cyan-200" : "border-transparent text-slate-400 hover:text-white"}`}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          {tab === "Videos" || tab === "Shorts" ? <>
            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-4">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === "Shorts" ? "Search Shorts..." : "Search videos..."} className="min-w-[190px] flex-1 rounded-lg border border-white/10 bg-[#090f1d] px-3 py-2 text-sm outline-none focus:border-cyan-300/60" />
              <select value={visibility} onChange={e => setVisibility(e.target.value)} className="rounded-lg border border-white/10 bg-[#090f1d] px-3 py-2 text-sm">
                <option value="ALL">All visibility</option>
                <option value="PUBLIC">Public</option>
                <option value="UNLISTED">Unlisted</option>
                <option value="PRIVATE">Private</option>
              </select>
              <span className="text-xs text-slate-400">{filtered.length} videos</span>
            </div>

            {error && <p role="alert" className="m-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
            {loading ? <p className="p-8 text-sm text-slate-400">Loading content…</p> :
              filtered.length === 0 ? <div className="p-10 text-center"><p className="font-semibold">No videos found</p><p className="mt-1 text-sm text-slate-400">Upload a video or adjust your search and filters.</p></div> :
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-white/[0.025] text-xs text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Video</th>
                      {role === "ADMIN" && <th className="px-3 py-3 font-medium">Channel</th>}
                      <th className="px-3 py-3 font-medium">Notices / status</th>
                      <th className="px-3 py-3 font-medium">Visibility</th>
                      <th className="px-3 py-3 font-medium">Date</th>
                      <th className="px-3 py-3 text-right font-medium">Views</th>
                      <th className="px-3 py-3 text-right font-medium">Comments</th>
                      <th className="px-4 py-3 text-right font-medium">Likes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {filtered.map(video => (
                      <tr key={video.id} className="align-top hover:bg-white/[0.025]">
                        <td className="max-w-[430px] px-4 py-3">
                          <button onClick={() => setExpanded(expanded === video.id ? null : video.id)} className="flex w-full items-start gap-3 text-left">
                            <div className="relative h-[68px] w-[120px] shrink-0 overflow-hidden rounded-md bg-slate-800">
                              {video.thumbnailUrl && <Image src={video.thumbnailUrl} alt="" width={120} height={68} unoptimized className="h-full w-full object-cover" />}
                              {!video.thumbnailUrl && <div className="flex h-full items-center justify-center text-xs text-slate-500">No thumbnail</div>}
                            </div>
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-semibold text-white">{video.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs text-slate-400">{video.description || "No description"}</p>
                              <p className="mt-1 text-[11px] text-cyan-300">{expanded === video.id ? "Close details ↑" : "Edit details ↓"}</p>
                            </div>
                          </button>
                        </td>
                        {role === "ADMIN" && <td className="px-3 py-4 text-xs text-slate-300">{video.channelName}<p className="mt-1 text-slate-500">{video.ownerName}</p></td>}
                        <td className="px-3 py-4">
                          <span className={`rounded-full px-2 py-1 text-[11px] ${video.status === "READY" ? "bg-emerald-400/10 text-emerald-300" : video.status === "FAILED" ? "bg-red-400/10 text-red-300" : "bg-amber-300/10 text-amber-200"}`}>{video.status}</span>
                          <p className="mt-2 text-[11px] text-slate-500">{video.transcodeJob?.status || "No job"} · {video.renditionCount} qualities</p>
                        </td>
                        <td className="px-3 py-4 text-xs text-slate-300">
                          {video.scheduledAt ? (
                            <span className="text-amber-300">
                              Scheduled · {video.scheduledVisibility || "PUBLIC"}
                              <span className="mt-1 block text-[11px] text-slate-400">
                                {new Date(video.scheduledAt).toLocaleString()}
                              </span>
                            </span>
                          ) : video.visibility}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-xs text-slate-400">{new Date(video.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-4 text-right text-xs text-slate-500">Not tracked</td>
                        <td className="px-3 py-4 text-right text-xs tabular-nums">{video.commentCount}</td>
                        <td className="px-4 py-4 text-right text-xs tabular-nums">{video.likeCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }

            {expanded && videos.some(v => v.id === expanded) && (() => {
              const video = videos.find(v => v.id === expanded)!;
              return <div className="border-t border-cyan-300/20 bg-[#0b1322] p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div><h3 className="font-bold">Edit {video.isShort ? "Short" : "video"} details</h3><p className="text-xs text-slate-400">Changes are saved to this video.</p></div>
                  <button onClick={() => setExpanded(null)} className="text-sm text-slate-400 hover:text-white">Close ×</button>
                </div>
                <form onSubmit={e => void saveVideo(e, video.id)} className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-slate-200 md:col-span-2">
                    <input name="isShort" type="checkbox" defaultChecked={video.isShort}
                      className="h-4 w-4 accent-cyan-300" />
                    <span>Manage as a Short</span>
                    <span className="text-xs text-slate-500">Appears in the Shorts Studio list</span>
                  </label>
                  <label className="text-xs text-slate-300 md:col-span-2">Title
                    <input name="title" required maxLength={180} defaultValue={video.title} className="mt-1 w-full rounded-lg border border-white/10 bg-[#101727] p-3 text-sm text-white" />
                  </label>
                  <label className="text-xs text-slate-300 md:col-span-2">Description
                    <textarea name="description" rows={4} maxLength={5000} defaultValue={video.description || ""} className="mt-1 w-full rounded-lg border border-white/10 bg-[#101727] p-3 text-sm text-white" />
                  </label>
                  <label className="text-xs text-slate-300">Category
                    <select name="category" defaultValue={video.category || ""} className="mt-1 w-full rounded-lg border border-white/10 bg-[#101727] p-3 text-sm text-white">
                      <option value="">Select category</option>
                      {["Music","Education","Entertainment","Gaming","News","Sports","Technology","Science","Travel","Lifestyle","Comedy","Film & Animation","People & Blogs","How-to & Style","Autos & Vehicles","Nonprofits & Activism"].map(x => <option key={x}>{x}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-300">Language
                    <select name="language" defaultValue={video.language || ""} className="mt-1 w-full rounded-lg border border-white/10 bg-[#101727] p-3 text-sm text-white">
                      <option value="">Auto / not specified</option>
                      <option value="en">English</option><option value="ur">Urdu</option><option value="ar">Arabic</option><option value="hi">Hindi</option><option value="pa">Punjabi</option><option value="ps">Pashto</option><option value="sd">Sindhi</option><option value="bn">Bengali</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-300">Visibility
                    <select name="visibility" defaultValue={video.visibility} className="mt-1 w-full rounded-lg border border-white/10 bg-[#101727] p-3 text-sm text-white">
                      <option value="PUBLIC">Public</option><option value="UNLISTED">Unlisted</option><option value="PRIVATE">Private</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap items-end gap-2">
                    <button type="submit" className="rounded-lg bg-cyan-300 px-4 py-3 text-sm font-bold text-slate-950">Save changes</button>
                    <button type="button" onClick={() => void deleteVideo(video.id, video.title)} className="rounded-lg border border-red-400/30 px-4 py-3 text-sm text-red-300 hover:bg-red-500/10">Delete video</button>
                  </div>
                  <p className="text-[11px] text-slate-500 md:col-span-2">Storage: {video.storageLabel} · Video ID: {video.id}</p>
                </form>
              </div>;
            })()}
          </> : tab === "Live" ? <StudioLivePanel /> : tab === "Podcasts" ? <StudioPodcastsPanel /> : tab === "Promotions" ? <StudioPromotionsPanel role={role} /> : <div className="p-10 text-center">
            <p className="font-semibold">{tab}</p>
            <p className="mt-2 text-sm text-slate-400">This content type is not yet supported by the current platform database. No sample entries are displayed.</p>
          </div>}
        </section>
      </div>
    </main>
  );
}
