import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getApiCache, setApiCache } from "@/lib/api-protection";

type SearchItem = {
  id: string;
  title: string;
  creator: string;
  sourceId: string;
  thumbnail: string;
  published: string;
  description: string;
  url: string;
  provider: "YouTube" | "Vimeo" | "Dailymotion";
};

type ThumbnailSet = {
  high?: { url?: string };
  medium?: { url?: string };
  default?: { url?: string };
};

type YouTubeSearchItem = {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    channelId?: string;
    thumbnails?: ThumbnailSet;
    publishedAt?: string;
    description?: string;
  };
};

type VimeoSearchItem = {
  uri?: string;
  link?: string;
  name?: string;
  user?: { name?: string; uri?: string };
  pictures?: { sizes?: { link?: string }[] };
  created_time?: string;
  description?: string;
};

type DailymotionSearchItem = {
  id?: string;
  title?: string;
  "owner.screenname"?: string;
  "owner.id"?: string;
  thumbnail_url?: string;
  created_time?: number;
  description?: string;
  url?: string;
};

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request.headers, "video-search", 30);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many searches." }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfter) },
    });
  }
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") || "").trim();
  const category = (params.get("category") || "").trim();
  const isDiscovery = query.length === 0;
  const discoveryQuery = category === "Bollywood Movies Full"
    ? "Bollywood official full movies"
    : category === "Hollywood Movies Full"
      ? "Hollywood official full movies"
      : category || "latest trending videos";
  const country = params.get("country") || "";
  const language = params.get("language") || "";
  const provider = params.get("provider") || "All platforms";

  if (query.length > 120 || category.length > 60) {
    return NextResponse.json({ error: "Search input is too long." }, { status: 400 });
  }

  if (
    (country && !["USA", "UK", "France", "Japan", "Korea"].includes(country)) ||
    (language && !["English", "French", "Japanese", "Korean"].includes(language)) ||
    !["All platforms", "YouTube", "Vimeo", "Dailymotion"].includes(provider)
  ) {
    return NextResponse.json({ error: "Invalid search filter." }, { status: 400 });
  }

  const movieSearchTerms: Record<string, string> = {
    "Bollywood Movies Full": "Bollywood official full movies",
    "Hollywood Movies Full": "Hollywood official full movies",
  };
  const searchQuery = movieSearchTerms[category]
    ? [query, movieSearchTerms[category]].filter(Boolean).join(" ")
    : [query, category].filter(Boolean).join(" ");
  const cacheKey = JSON.stringify([query, category, country, language, provider, new Date().toISOString().slice(0, 10)]);
  const cached = getApiCache<{ items: unknown[]; warning: string | null }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const regions: Record<string, string> = {
    USA: "US", UK: "GB", France: "FR", Japan: "JP", Korea: "KR"
  };
  const languages: Record<string, string> = {
    English: "en", French: "fr", Japanese: "ja", Korean: "ko"
  };

  // Verified movie sources are queried directly, not buried in global search results.
  const movieKey = category === "Bollywood Movies Full"
    ? "BOLLYWOOD"
    : category === "Hollywood Movies Full"
      ? "HOLLYWOOD"
      : null;
  const approvedSources: Record<string, Set<string>> = movieKey ? {
    YouTube: new Set((process.env[`VIEWERS_TUBE_${movieKey}_YOUTUBE_CHANNEL_IDS`] || "").split(",").map((id) => id.trim()).filter(Boolean)),
    Vimeo: new Set((process.env[`VIEWERS_TUBE_${movieKey}_VIMEO_USER_IDS`] || "").split(",").map((id) => id.trim()).filter(Boolean)),
    Dailymotion: new Set((process.env[`VIEWERS_TUBE_${movieKey}_DAILYMOTION_CHANNEL_IDS`] || "").split(",").map((id) => id.trim()).filter(Boolean)),
  } : {};

  const tasks: Promise<SearchItem[]>[] = [];

  if (provider === "All platforms" || provider === "YouTube") {
    tasks.push((async () => {
      const key = process.env.YOUTUBE_API_KEY;
      if (!key) throw new Error("YouTube API key is missing.");

      const channelIds = movieKey
        ? [...(approvedSources.YouTube || new Set<string>())]
        : [];

      const searchUrls = movieKey
        ? channelIds.map((channelId) => {
            const url = new URL("https://www.googleapis.com/youtube/v3/search");
            url.searchParams.set("part", "snippet");
            url.searchParams.set("type", "video");
            url.searchParams.set("maxResults", "50");
            url.searchParams.set("order", "date");
            url.searchParams.set("publishedAfter", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
            url.searchParams.set("channelId", channelId);
            url.searchParams.set("q", "full movie");
            url.searchParams.set("safeSearch", "moderate");
            url.searchParams.set("key", key);
            return url;
          })
        : [(() => {
            const url = new URL("https://www.googleapis.com/youtube/v3/search");
            url.searchParams.set("part", "snippet");
            url.searchParams.set("type", "video");
            url.searchParams.set("maxResults", "12");
            url.searchParams.set("order", isDiscovery ? "date" : "relevance");
            url.searchParams.set("safeSearch", "moderate");
            url.searchParams.set("q", isDiscovery ? discoveryQuery : searchQuery);
            url.searchParams.set("key", key);
            if (regions[country]) url.searchParams.set("regionCode", regions[country]);
            if (languages[language]) url.searchParams.set("relevanceLanguage", languages[language]);
            return url;
          })()];

      const responses = await Promise.all(searchUrls.map(async (url) => {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
        const data = (await response.json()) as { items?: YouTubeSearchItem[]; error?: { message?: string } };
        if (!response.ok) throw new Error(data.error?.message || "YouTube search failed.");
        return data.items || [];
      }));

      return responses.flat().map((item): SearchItem => ({
        id: item.id?.videoId || "",
        title: item.snippet?.title || "Untitled video",
        creator: item.snippet?.channelTitle || "YouTube creator",
        sourceId: item.snippet?.channelId || "",
        thumbnail: item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url || "",
        published: item.snippet?.publishedAt || "",
        description: item.snippet?.description || "",
        url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
        provider: "YouTube"
      }));
    })());
  }

  if (provider === "All platforms" || provider === "Vimeo") {
    tasks.push((async () => {
      const token = process.env.VIMEO_ACCESS_TOKEN;
      if (!token) throw new Error("Vimeo access token is missing. Check .env.local.");
      const url = new URL("https://api.vimeo.com/videos");
      url.searchParams.set("query", isDiscovery ? discoveryQuery : searchQuery);
      url.searchParams.set("per_page", "12");
      url.searchParams.set("sort", isDiscovery ? "date" : "relevant");
      if (isDiscovery) url.searchParams.set("direction", "desc");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.vimeo.*+json;version=3.4"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      });
      const data = (await response.json()) as { data?: VimeoSearchItem[]; error?: { message?: string } };
      if (!response.ok) throw new Error(data.error?.message || "Vimeo search failed.");

      return (data.data || []).map((item): SearchItem => ({
        id: item.uri || item.link || "",
        title: item.name || "Untitled video",
        creator: item.user?.name || "Vimeo creator",
        sourceId: item.user?.uri || "",
        thumbnail: item.pictures?.sizes?.slice(-1)[0]?.link || "",
        published: item.created_time || "",
        description: item.description || "",
        url: item.link || "",
        provider: "Vimeo"
      }));
    })());
  }

  if (provider === "All platforms" || provider === "Dailymotion") {
    tasks.push((async () => {
      const url = new URL("https://api.dailymotion.com/videos");
      url.searchParams.set("search", isDiscovery ? discoveryQuery : searchQuery);
      url.searchParams.set("limit", "12");
      if (isDiscovery) url.searchParams.set("sort", "recent");
      url.searchParams.set(
        "fields",
        "id,title,thumbnail_url,url,owner.id,owner.screenname,created_time,description"
      );

      const response = await fetch(url, {
        headers: { "User-Agent": "ViewersTube/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      });
      const data = (await response.json()) as { list?: DailymotionSearchItem[] };
      if (!response.ok) throw new Error("Dailymotion search failed.");

      return (data.list || []).map((item): SearchItem => ({
        id: item.id || "",
        title: item.title || "Untitled video",
        creator: item["owner.screenname"] || "Dailymotion creator",
        sourceId: item["owner.id"] || "",
        thumbnail: item.thumbnail_url || "",
        published: item.created_time
          ? new Date(item.created_time * 1000).toISOString()
          : "",
        description: item.description || "",
        url: item.url || `https://www.dailymotion.com/video/${item.id}`,
        provider: "Dailymotion"
      }));
    })());
  }

  const results = await Promise.allSettled(tasks);
  const items: SearchItem[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") items.push(...result.value);
    else errors.push(result.reason?.message || "A platform search failed.");
  }

  if (!items.length && errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 502 });
  }

  // Movie categories show only explicitly approved provider account IDs.
  const filteredItems = movieKey
    ? items.filter((item) => approvedSources[item.provider]?.has(item.sourceId))
    : items;

  // Remove duplicate provider/video entries before rotating discovery results.
  const uniqueItems = filteredItems.filter((item, index, all) =>
    all.findIndex((other) => other.provider === item.provider && other.id === item.id) === index
  );

  // Keep newer published videos ahead of older ones, while rotating
  // results within each publication date for daily discovery variety.
  const datedGroups = new Map<string, SearchItem[]>();
  const undatedItems: SearchItem[] = [];

  for (const item of uniqueItems) {
    const timestamp = item.published ? Date.parse(item.published) : NaN;
    if (!Number.isFinite(timestamp)) {
      undatedItems.push(item);
      continue;
    }

    const dateKey = new Date(timestamp).toISOString().slice(0, 10);
    const group = datedGroups.get(dateKey) || [];
    group.push(item);
    datedGroups.set(dateKey, group);
  }

  const dayNumber = Math.floor(Date.now() / 86400000);
  const rotateGroup = (group: SearchItem[]) => {
    if (group.length < 2) return group;
    const offset = dayNumber % group.length;
    return [...group.slice(offset), ...group.slice(0, offset)];
  };

  const rotatedItems = [
    ...[...datedGroups.entries()]
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .flatMap(([, group]) => rotateGroup(group)),
    ...rotateGroup(undatedItems),
  ];

  const publicItems = rotatedItems.map((item) => {
    const { sourceId, ...publicItem } = item;
    void sourceId;
    return publicItem;
  });
  const result = { items: publicItems, warning: errors.join(" ") || null };
  setApiCache(cacheKey, result, 60_000);
  return NextResponse.json(result);
}
