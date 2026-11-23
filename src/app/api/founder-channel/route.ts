import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getApiCache, setApiCache } from "@/lib/api-protection";

const HANDLE = "@adnansajjad786";
const CHANNEL_URL = "https://www.youtube.com/@adnansajjad786";

type YouTubePlaylistItem = {
  contentDetails?: {
    videoId?: string;
    videoPublishedAt?: string;
  };
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    resourceId?: { videoId?: string };
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
};

type FounderResponse = {
  channel: {
    title: string;
    thumbnail: string;
    url: string;
  };
  items: {
    id: string;
    title: string;
    creator: string;
    thumbnail: string;
    published: string;
    description: string;
    url: string;
    provider: string;
  }[];
};

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request.headers, "founder-channel", 30);

  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfter) },
      }
    );
  }

  const cached = getApiCache<FounderResponse>("founder-youtube-channel-v1");
  if (cached) return NextResponse.json(cached);

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "The YouTube API key is not configured on the server." },
      { status: 503 }
    );
  }

  try {
    const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
    channelUrl.searchParams.set("part", "snippet,contentDetails");
    channelUrl.searchParams.set("forHandle", HANDLE);
    channelUrl.searchParams.set("key", key);

    const channelResponse = await fetch(channelUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const channelData = await channelResponse.json();

    if (!channelResponse.ok) {
      throw new Error(
        channelData.error?.message || "YouTube could not load the Founder channel."
      );
    }

    const channel = channelData.items?.[0];
    if (!channel) {
      throw new Error("YouTube could not find the channel for " + HANDLE + ".");
    }

    const uploadsPlaylist =
      channel.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylist) {
      throw new Error("YouTube did not return the channel uploads playlist.");
    }

    const playlistUrl = new URL(
      "https://www.googleapis.com/youtube/v3/playlistItems"
    );
    playlistUrl.searchParams.set("part", "snippet,contentDetails");
    playlistUrl.searchParams.set("playlistId", uploadsPlaylist);
    playlistUrl.searchParams.set("maxResults", "12");
    playlistUrl.searchParams.set("key", key);

    const playlistResponse = await fetch(playlistUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const playlistData = (await playlistResponse.json()) as {
      items?: YouTubePlaylistItem[];
      error?: { message?: string };
    };

    if (!playlistResponse.ok) {
      throw new Error(
        playlistData.error?.message || "YouTube could not load channel uploads."
      );
    }

    const channelTitle = channel.snippet?.title || "Adnan Sajjad";
    const channelThumbnail =
      channel.snippet?.thumbnails?.high?.url ||
      channel.snippet?.thumbnails?.medium?.url ||
      channel.snippet?.thumbnails?.default?.url ||
      "";

    const items = (playlistData.items || [])
      .map((item) => {
        const id =
          item.contentDetails?.videoId ||
          item.snippet?.resourceId?.videoId;

        if (!id) return null;

        return {
          id,
          title: item.snippet?.title || "Untitled video",
          creator: channelTitle,
          thumbnail:
            item.snippet?.thumbnails?.high?.url ||
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            "",
          published:
            item.contentDetails?.videoPublishedAt ||
            item.snippet?.publishedAt ||
            "",
          description: item.snippet?.description || "",
          url: `https://www.youtube.com/watch?v=${id}`,
          provider: "YouTube",
        };
      })
      .filter((item): item is FounderResponse["items"][number] => item !== null);

    const result: FounderResponse = {
      channel: {
        title: channelTitle,
        thumbnail: channelThumbnail,
        url: CHANNEL_URL,
      },
      items,
    };

    setApiCache("founder-youtube-channel-v1", result, 5 * 60 * 1000);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load the YouTube channel.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
