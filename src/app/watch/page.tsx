import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NativeVideoPlayer } from "./native-video-player";

export const instant = false;

type SearchParams = {
  provider?: string;
  id?: string;
  title?: string;
  creator?: string;
};

function getPlayer(providerInput: string, idInput: string) {
  const provider = providerInput.toLowerCase().trim();
  const rawId = idInput.trim();

  if (provider === "youtube") {
    if (!/^[A-Za-z0-9_-]{11}$/.test(rawId)) return null;
    return {
      name: "YouTube",
      embed: `https://www.youtube-nocookie.com/embed/${rawId}`,
      original: `https://www.youtube.com/watch?v=${rawId}`,
    };
  }

  if (provider === "vimeo") {
    const match = rawId.match(/(?:videos\/)?(\d{5,15})/);
    if (!match) return null;
    return {
      name: "Vimeo",
      embed: `https://player.vimeo.com/video/${match[1]}`,
      original: `https://vimeo.com/${match[1]}`,
    };
  }

  if (provider === "dailymotion") {
    if (!/^[A-Za-z0-9]{5,20}$/.test(rawId)) return null;
    return {
      name: "Dailymotion",
      embed: `https://www.dailymotion.com/embed/video/${rawId}`,
      original: `https://www.dailymotion.com/video/${rawId}`,
    };
  }

  if (provider === "terabox") {
    if (!/^[A-Za-z0-9_-]{5,80}$/.test(rawId)) return null;
    return {
      name: "TeraBox",
      embed: `https://dm.terabox.app/sharing/link?surl=${encodeURIComponent(rawId)}&clearCache=1`,
      original: `https://1024terabox.com/s/1${rawId}`,
    };
  }

  return null;
}

export default async function WatchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const provider = (params.provider || "").toLowerCase().trim();
  const nativeVideo = provider === "viewers_tube" && params.id
    ? await prisma.video.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          title: true,
          status: true,
          visibility: true,
          channel: { select: { name: true } },
        },
      })
    : null;

  const nativeReady = nativeVideo?.status === "READY" &&
    nativeVideo.visibility !== "PRIVATE";

  const player = getPlayer(provider, params.id || "");
  const title = (nativeReady ? nativeVideo.title : params.title || "Video").slice(0, 200);
  const creator = (nativeReady ? nativeVideo.channel.name : params.creator || "").slice(0, 120);

  return (
    <main style={{ minHeight: "100vh", background: "#080b12", color: "#f5f7fb", padding: "32px 5%", fontFamily: "Arial, sans-serif" }}>
      <Link href="/" style={{ color: "#9ba9ff", textDecoration: "none" }}>← Back to Viewers Tube</Link>
      <div style={{ maxWidth: 1100, margin: "28px auto" }}>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 38px)", marginBottom: 8 }}>{title}</h1>
        {creator && <p style={{ color: "#aab2c5", marginBottom: 22 }}>{creator}</p>}
        {provider === "viewers_tube" ? (
          nativeReady && nativeVideo ? (
            <>
              <NativeVideoPlayer videoId={nativeVideo.id} />
              <p style={{ color: "#aab2c5", lineHeight: 1.6, marginTop: 18 }}>
                Playing a Viewers Tube video from its creator&apos;s private storage connection.
              </p>
            </>
          ) : (
            <p style={{ marginTop: 24, color: "#ffb5b5" }}>
              This Viewers Tube video is unavailable, private, or still processing.
            </p>
          )
        ) : player ? (
          <>
            {player.name === "TeraBox" ? (
              <div style={{ padding: 28, background: "#151c2b", borderRadius: 14 }}>
                <h2>TeraBox video</h2>
                <p style={{ color: "#aab2c5", margin: "12px 0 20px" }}>
                  This video is hosted on TeraBox. Open it there to watch.
                </p>
                <a href={player.original} target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-block", padding: "12px 18px", borderRadius: 9, background: "#5265df", color: "white", textDecoration: "none" }}>
                  Open video on TeraBox ↗
                </a>
              </div>
            ) : (
            <>
            <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", background: "#000", borderRadius: 14, overflow: "hidden" }}>
              <iframe
                src={player.embed}
                title={title}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <p style={{ color: "#aab2c5", lineHeight: 1.6, marginTop: 18 }}>
              Playing through the official {player.name} player. The video remains hosted by its original owner. Some videos may not allow embedding.
            </p>
            <a href={player.original} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 8, padding: "12px 18px", borderRadius: 9, background: "#242b3d", color: "white", textDecoration: "none" }}>
              Open original on {player.name} ↗
            </a>
            </>
            )}
          </>
        ) : (
          <p style={{ marginTop: 24, color: "#ffb5b5" }}>
            This video link or provider is not supported. Return to Viewers Tube and select another video.
          </p>
        )}
      </div>
    </main>
  );
}
