"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Episode = {
  id: string;
  title: string;
  description: string | null;
  contentType: string;
  sizeBytes: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
};

type Podcast = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  artworkUrl: string | null;
  category: string | null;
  language: string;
  channel: { name: string; slug: string };
  episodes: Episode[];
};

type Player = {
  episodeId: string;
  url: string;
  contentType: string;
  title: string;
};

export default function PublicPodcastsSection() {
  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<Player | null>(null);
  const [playbackBusy, setPlaybackBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/podcasts")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load podcasts.");
        return response.json();
      })
      .then((data) => {
        if (active) setPodcasts(data.podcasts ?? []);
      })
      .catch(() => {
        if (active) setError("Podcasts are temporarily unavailable.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function playEpisode(episode: Episode) {
    if (player?.episodeId === episode.id) {
      setPlayer(null);
      return;
    }

    setPlaybackBusy(episode.id);
    setError("");

    try {
      const response = await fetch(
        `/api/podcasts/episodes/${episode.id}/playback`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not start playback.");
      }

      setPlayer({
        episodeId: episode.id,
        url: data.url,
        contentType: data.contentType,
        title: data.title,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Playback failed.");
    } finally {
      setPlaybackBusy(null);
    }
  }

  if (!loading && podcasts.length === 0 && !error) return null;

  return (
    <section className="content-section" id="podcasts">
      <div className="section-heading">
        <div>
          <div className="eyebrow">LISTEN · WATCH · DISCOVER</div>
          <h2>Explore <span>podcasts.</span></h2>
        </div>
        <span className="result-count">
          {loading ? "Loading..." : `${podcasts.length} podcasts`}
        </span>
      </div>

      {error && (
        <p className="mb-3 text-sm text-amber-400" role="status">{error}</p>
      )}

      <div className="space-y-4">
        {podcasts.slice(0, 8).map((podcast) => (
          <article
            key={podcast.id}
            className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40"
          >
            <div className="flex items-center gap-3 border-b border-white/10 p-3">
              {podcast.artworkUrl ? (
                <Image
                  src={podcast.artworkUrl}
                  alt=""
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xl text-cyan-300">
                  ◉
                </div>
              )}

              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-white">
                  {podcast.title}
                </h3>
                <p className="mt-1 truncate text-xs text-slate-400">
                  {podcast.channel.name}
                  {podcast.category ? ` · ${podcast.category}` : ""}
                  {" · "}{podcast.language.toUpperCase()}
                </p>
                {podcast.description && (
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                    {podcast.description}
                  </p>
                )}
              </div>

              <span className="shrink-0 text-[10px] text-slate-500">
                {podcast.episodes.length} episodes
              </span>
            </div>

            <div className="divide-y divide-white/5">
              {podcast.episodes.slice(0, 3).map((episode) => {
                const isPlaying = player?.episodeId === episode.id;
                const isVideo = episode.contentType.startsWith("video/");

                return (
                  <div key={episode.id} className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-3">
                      {isVideo && episode.thumbnailUrl ? (
                        <Image
                          src={episode.thumbnailUrl}
                          alt=""
                          width={72}
                          height={48}
                          unoptimized
                          className="h-12 w-[72px] shrink-0 rounded-md bg-black object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-500">
                          {isVideo ? "VIDEO" : "AUDIO"}
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                        {episode.title}
                      </span>
                      {episode.durationSeconds != null && (
                        <span className="text-xs text-slate-500">
                          {Math.floor(episode.durationSeconds / 60)}:
                          {String(episode.durationSeconds % 60).padStart(2, "0")}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={playbackBusy === episode.id}
                        onClick={() => void playEpisode(episode)}
                        className="rounded-md border border-cyan-800 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-950 disabled:opacity-40"
                      >
                        {playbackBusy === episode.id
                          ? "Loading..."
                          : isPlaying ? "Stop" : "Play"}
                      </button>
                    </div>

                    {isPlaying && (
                      <div className="mt-3">
                        {isVideo ? (
                          <video
                            key={player.url}
                            src={player.url}
                            controls
                            autoPlay
                            playsInline
                            className="max-h-96 w-full rounded-lg bg-black"
                          />
                        ) : (
                          <audio
                            key={player.url}
                            src={player.url}
                            controls
                            autoPlay
                            className="w-full"
                          />
                        )}
                        <p className="mt-1 text-[11px] text-slate-500">
                          {player.title}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
