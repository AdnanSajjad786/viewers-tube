/**
 * Validate browser Origin against the public request host.
 * Supports reverse proxies that forward a public host while
 * Next.js internally sees a different URL or protocol.
 */
export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();

  const requestHost = request.headers.get("host")?.trim();
  const expectedHost = forwardedHost || requestHost;

  if (!expectedHost || parsed.host.toLowerCase() !== expectedHost.toLowerCase()) {
    return false;
  }

  const forwardedProto = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProto && parsed.protocol !== `${forwardedProto}:`) {
    return false;
  }

  return true;
}
