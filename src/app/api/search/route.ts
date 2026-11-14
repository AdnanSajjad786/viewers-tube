import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getApiCache, setApiCache } from "@/lib/api-protection";

export async function GET(request: NextRequest) {
  const rate = checkRateLimit(request.headers, "video-search", 30);
  if (!rate.allowed) {
    return NextResponse.json({ error: "Too many searches." }, {
      status: 429,
      headers: { "Retry-After": String(rate.retryAfter) },
    });
  }
  const params = request.nextUrl.searchParams;
  const query = (params.get("q") || "popular videos").trim();
  const category = (params.get("category") || "").trim();
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

  const searchQuery = [query, category].filter(Boolean).join(" ");
  const cacheKey = JSON.stringify([query, category, country, language, provider]);
  const cached = getApiCache<{ items: unknown[]; warning: string | null }>(cacheKey);
  if (cached) return NextResponse.json(cached);

  const regions: Record<string, string> = {
    USA: "US", UK: "GB", France: "FR", Japan: "JP", Korea: "KR"
  };
  const languages: Record<string, string> = {
    English: "en", French: "fr", Japanese: "ja", Korean: "ko"
  };

  const tasks: Promise<any>[] = [];

  if (provider === "All platforms" || provider === "YouTube") {
    tasks.push((async () => {
      const key = process.env.YOUTUBE_API_KEY;
      if (!key) throw new Error("YouTube API key is missing.");
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "12");
      url.searchParams.set("order", "relevance");
      url.searchParams.set("safeSearch", "moderate");
      url.searchParams.set("q", searchQuery);
      url.searchParams.set("key", key);
      if (regions[country]) url.searchParams.set("regionCode", regions[country]);
      if (languages[language]) url.searchParams.set("relevanceLanguage", languages[language]);

      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "YouTube search failed.");

      return (data.items || []).map((item: any) => ({
        id: item.id?.videoId,
        title: item.snippet?.title || "Untitled video",
        creator: item.snippet?.channelTitle || "YouTube creator",
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
      url.searchParams.set("query", searchQuery);
      url.searchParams.set("per_page", "12");
      url.searchParams.set("sort", "relevant");

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.vimeo.*+json;version=3.4"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || "Vimeo search failed.");

      return (data.data || []).map((item: any) => ({
        id: item.uri || item.link,
        title: item.name || "Untitled video",
        creator: item.user?.name || "Vimeo creator",
        thumbnail: item.pictures?.sizes?.slice(-1)[0]?.link || "",
        published: item.created_time || "",
        description: item.description || "",
        url: item.link,
        provider: "Vimeo"
      }));
    })());
  }

  if (provider === "All platforms" || provider === "Dailymotion") {
    tasks.push((async () => {
      const url = new URL("https://api.dailymotion.com/videos");
      url.searchParams.set("search", searchQuery);
      url.searchParams.set("limit", "12");
      url.searchParams.set(
        "fields",
        "id,title,thumbnail_url,url,owner.screenname,created_time,description"
      );

      const response = await fetch(url, {
        headers: { "User-Agent": "ViewersTube/1.0" },
        cache: "no-store",
        signal: AbortSignal.timeout(15000)
      });
      const data = await response.json();
      if (!response.ok) throw new Error("Dailymotion search failed.");

      return (data.list || []).map((item: any) => ({
        id: item.id,
        title: item.title || "Untitled video",
        creator: item["owner.screenname"] || "Dailymotion creator",
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
  const items: any[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") items.push(...result.value);
    else errors.push(result.reason?.message || "A platform search failed.");
  }

  if (!items.length && errors.length) {
    return NextResponse.json({ error: errors.join(" ") }, { status: 502 });
  }

  const result = { items, warning: errors.join(" ") || null };
  setApiCache(cacheKey, result, 60_000);
  return NextResponse.json(result);
}
