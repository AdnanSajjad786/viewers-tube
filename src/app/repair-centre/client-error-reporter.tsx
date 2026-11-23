"use client";

import { useEffect } from "react";

export function ClientErrorReporter() {
  useEffect(() => {
    const endpoint = "/api/repair-centre/client-incident";
    const reported = new Set<string>();

    const report = (kind: string, message: string) => {
      const clean = message.slice(0, 1800);
      const key = `${kind}:${clean}`;
      if (reported.has(key)) return;
      reported.add(key);
      if (reported.size > 100) reported.clear();

      void window.fetch(endpoint, {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message: clean }),
      }).then((response) => {
        if (!response.ok) {
          console.warn(`[client-incident] Report was rejected: HTTP ${response.status}`);
        }
      }).catch((error) => {
        console.warn("[client-incident] Report could not reach the server:", error);
      });
    };

    const onError = (event: ErrorEvent) => {
      report("browser-error", [
        event.message || "Browser error",
        event.filename ? new URL(event.filename, window.location.origin).pathname : "",
        event.lineno ? `line ${event.lineno}` : "",
      ].filter(Boolean).join(" | "));
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report("unhandledrejection",
        reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? "Unhandled promise rejection")
      );
    };

    const originalFetch = window.fetch.bind(window);
    const monitoredFetch: typeof window.fetch = async (input, init) => {
      let path = "";
      try {
        const rawUrl = input instanceof Request ? input.url : String(input);
        path = new URL(rawUrl, window.location.origin).pathname;
      } catch {
        path = "";
      }

      try {
        const response = await originalFetch(input, init);
        if (path !== endpoint && response.status >= 500) {
          report("fetch-http", `HTTP ${response.status} from ${path || "unknown request"}`);
        }
        return response;
      } catch (error) {
        if (path !== endpoint) {
          const message = error instanceof Error ? error.message : String(error);
          report("fetch-network", `Network request failed at ${path || "unknown request"}: ${message}`);
        }
        throw error;
      }
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    window.fetch = monitoredFetch;

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      if (window.fetch === monitoredFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
