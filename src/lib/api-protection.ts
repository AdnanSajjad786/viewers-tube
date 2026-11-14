type RateEntry = { count: number; resetAt: number };
type CacheEntry = { value: unknown; expiresAt: number };

const shared = globalThis as typeof globalThis & {
  apiRateLimits?: Map<string, RateEntry>;
  apiResponseCache?: Map<string, CacheEntry>;
};

const rates = shared.apiRateLimits ??= new Map();
const cache = shared.apiResponseCache ??= new Map();

export function checkRateLimit(
  headers: Headers,
  bucket: string,
  limit = 30,
  windowMs = 60_000,
) {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim()
    || headers.get("x-real-ip")
    || "unknown";

  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = rates.get(key);

  if (!entry || entry.resetAt <= now) {
    rates.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count++;
  return { allowed: true, retryAfter: 0 };
}

export function getApiCache<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry || entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setApiCache<T>(key: string, value: T, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });

  if (cache.size > 1000) {
    const now = Date.now();
    for (const [cacheKey, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(cacheKey);
    }
  }
}
