"use client";

import { useCallback, useEffect, useState } from "react";

type Episode = {
  id: string;
  title: string;
  contentType: string;
  sizeBytes: string;
  status: string;
};

type Podcast = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: string;
  status: string;
  _count: { episodes: number };
  episodes: Episode[];
};

const formats: Record<string, string> = {
  mp3: "audio/mpeg", mp4: "video/mp4", m4a: "audio/mp4",
  aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg",
  flac: "audio/flac", webm: "video/webm", mov: "video/quicktime",
};

export function StudioPodcastsPanel() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [selected, setSelected] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [playing, setPlaying] = useState<{
    id: string;
    url: string;
    contentType: string;
    title: string;
  } | null>(null);
  const [playbackBusy, setPlaybackBusy] = useState(false);

  async function playEpisode(episode: Episode) {
    setPlaybackBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/studio/podcasts/episodes/${encodeURIComponent(episode.id)}/playback`
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not play episode.");
      setPlaying({
        id: episode.id,
        url: data.url,
        contentType: data.contentType,
        title: data.title,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Playback failed.");
    } finally {
      setPlaybackBusy(false);
    }
  }

  const loadPodcasts = useCallback(async () => {
    const response = await fetch("/api/studio/podcasts");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load podcasts.");
    setPodcasts(data.podcasts);
    setSelected((current) =>
      data.podcasts.some((p: Podcast) => p.id === current)
        ? current : data.podcasts[0]?.id || ""
    );
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        void loadPodcasts().catch((error: Error) => {
          if (active) setMessage(error.message);
        });
      }
    });
    return () => { active = false; };
  }, [loadPodcasts]);

  async function createPodcast(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/studio/podcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, visibility: "PUBLIC" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create podcast.");
      setTitle("");
      setDescription("");
      await loadPodcasts();
      setSelected(data.podcast.id);
      setMessage("Podcast created successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadEpisode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !selected) return;

    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const contentType = file.type || formats[extension];
    if (!contentType || !formats[extension]) {
      setMessage("Unsupported file. Choose MP3, M4A, AAC, WAV, OGG, FLAC, MP4, MOV or WebM.");
      return;
    }

    setBusy(true);
    setProgress(0);
    setMessage("");

    try {
      const initResponse = await fetch("/api/studio/podcasts/episodes/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          podcastId: selected,
          title: episodeTitle.trim() || file.name.replace(/\.[^.]+$/, ""),
          contentType,
          size: file.size,
        }),
      });
      const init = await initResponse.json();
      if (!initResponse.ok) throw new Error(init.error || "Could not start upload.");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", init.uploadUrl);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`Storage upload failed (${xhr.status}).`));
        };
        xhr.onerror = () => reject(new Error("Storage connection failed."));
        xhr.onabort = () => reject(new Error("Upload cancelled."));
        xhr.send(file);
      });

      const completeResponse = await fetch("/api/studio/podcasts/episodes/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: init.episodeId }),
      });
      const complete = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(complete.error || "Upload verification failed.");

      setFile(null);
      setEpisodeTitle("");
      setProgress(100);
      await loadPodcasts();
      setMessage("Episode uploaded and verified successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Episode upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function setPublishing(payload: {
    podcastId?: string;
    episodeId?: string;
    publish: boolean;
  }) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/studio/podcasts/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not update publishing status.");
      }
      await loadPodcasts();
      setMessage(
        payload.podcastId
          ? (payload.publish ? "Podcast published." : "Podcast unpublished.")
          : (payload.publish ? "Episode published." : "Episode unpublished.")
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Publishing update failed.");
    } finally {
      setBusy(false);
    }
  }

  const activePodcast = podcasts.find((p) => p.id === selected);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Podcasts</h2>
          <p className="text-xs text-slate-400">Manage audio and video podcast episodes.</p>
        </div>
        <button onClick={() => void loadPodcasts()} disabled={busy}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">
          Refresh
        </button>
      </div>

      {message && (
        <p role="status" className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-300">
          {message}
        </p>
      )}

      <form onSubmit={createPodcast} className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 md:grid-cols-[1fr_2fr_auto]">
        <input required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="New podcast title"
          className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        <input maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
        <button disabled={busy || !title.trim()}
          className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">
          Create podcast
        </button>
      </form>

      {podcasts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {podcasts.map((podcast) => (
            <button key={podcast.id} onClick={() => setSelected(podcast.id)}
              className={`rounded-lg border px-3 py-2 text-left text-sm ${
                selected === podcast.id
                  ? "border-cyan-400 bg-cyan-400/10 text-cyan-200"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}>
              {podcast.title}
              <span className="ml-2 text-xs text-slate-500">{podcast._count.episodes} episodes</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-700 p-5 text-center text-sm text-slate-400">
          Create your first podcast to start uploading episodes.
        </p>
      )}

      {activePodcast && (
        <>
          <form onSubmit={uploadEpisode} className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Upload episode · {activePodcast.title}</h3>
                <span className={`text-[10px] font-semibold ${activePodcast.status === "PUBLISHED" ? "text-emerald-400" : "text-amber-400"}`}>
                  {activePodcast.status}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void setPublishing({
                    podcastId: activePodcast.id,
                    publish: activePodcast.status !== "PUBLISHED",
                  })}
                  className="rounded-md border border-cyan-700 px-2.5 py-1.5 text-[11px] text-cyan-300 hover:bg-cyan-950 disabled:opacity-40"
                >
                  {activePodcast.status === "PUBLISHED" ? "Unpublish podcast" : "Publish podcast"}
                </button>
              </div>
              <span className="text-[11px] text-slate-500">Audio or video · Maximum 5 GB</span>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
              <input value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)}
                placeholder="Episode title (optional)"
                className="min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white" />
              <input type="file" accept="audio/*,video/mp4,video/webm,video/quicktime,.m4a,.mp3,.aac,.wav,.ogg,.flac,.mp4,.mov,.webm"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="min-w-0 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100" />
              <button disabled={busy || !file}
                className="rounded-lg bg-cyan-300 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">
                {busy ? "Uploading..." : "Upload episode"}
              </button>
            </div>
            {file && <p className="text-xs text-slate-400">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
            {busy && (
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}
          </form>

          <div className="overflow-hidden rounded-xl border border-slate-800">
            <div className="grid grid-cols-[minmax(0,1fr)_65px_75px_auto] gap-3 bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">
              <span>Episode</span><span>Format</span><span>Status</span><span>Action</span>
            </div>
            {activePodcast.episodes.length ? activePodcast.episodes.map((episode) => (
              <div key={episode.id} className="border-t border-slate-800 px-3 py-3">
                <div className="grid grid-cols-[minmax(0,1fr)_65px_75px_auto] items-center gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-200">{episode.title}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{(Number(episode.sizeBytes) / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                  <span className="text-slate-400">{episode.contentType.startsWith("video/") ? "Video" : "Audio"}</span>
                  <span className={["READY", "PUBLISHED"].includes(episode.status) ? "text-emerald-400" : "text-amber-400"}>{episode.status}</span>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    {episode.status === "READY" || episode.status === "PUBLISHED" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void setPublishing({
                          episodeId: episode.id,
                          publish: episode.status !== "PUBLISHED",
                        })}
                        className="rounded-md border border-cyan-800 px-2 py-1.5 text-[11px] text-cyan-300 hover:bg-cyan-950 disabled:opacity-40"
                      >
                        {episode.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                    ) : null}
                    {playing?.id === episode.id ? (
                      <button type="button" onClick={() => setPlaying(null)} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-slate-300 hover:bg-slate-800">Stop</button>
                    ) : (
                      <button
                        type="button"
                        disabled={!["READY", "PUBLISHED"].includes(episode.status) || playbackBusy}
                        onClick={() => void playEpisode(episode)}
                        className="rounded-md border border-sky-700 px-2.5 py-1.5 text-sky-300 hover:bg-sky-950 disabled:cursor-not-allowed disabled:opacity-40"
                      >Play</button>
                    )}
                  </div>
                </div>
                {playing?.id === episode.id && (
                  <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950 p-2">
                    <p className="mb-2 truncate text-[11px] text-slate-400">Now playing: {playing.title}</p>
                    {playing.contentType.startsWith("video/") ? (
                      <video key={playing.url} controls autoPlay playsInline preload="metadata" src={playing.url} className="max-h-96 w-full rounded-md bg-black" />
                    ) : (
                      <audio key={playing.url} controls autoPlay preload="metadata" src={playing.url} className="w-full" />
                    )}
                  </div>
                )}
              </div>
            )) : (
              <p className="p-5 text-center text-xs text-slate-500">No episodes uploaded yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
