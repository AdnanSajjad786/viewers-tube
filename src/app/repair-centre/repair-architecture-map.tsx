"use client";

import { useMemo, useEffect, useState } from "react";

type Props = {
  role: string;
  checks?: Record<string, { status: string; label: string; detail?: string }>;
  metrics?: Record<string, number>;
  onRefresh?: () => void | Promise<void>;
  scanId?: number;
  onScanStateChange?: (busy: boolean) => void;
};

type ComponentId =
  | "database" | "authentication" | "website" | "worker" | "workerHeartbeat"
  | "videos" | "podcasts" | "storage" | "nativeLibrary" | "revive"
  | "reviveDatabase" | "cloudflare" | "mediamtx" | "github" | "nodeRuntime" | "nextFramework" | "browserErrors" | "apiRuntime";

type Action = "diagnose" | "issues" | "fix" | "optimize";

type RepairOption = {
  kind: string;
  id: string;
  label: string;
  attempts?: number;
  status?: string;
};

const definitions: {
  id: ComponentId;
  name: string;
  group: string;
  description: string;
}[] = [
  { id: "database", name: "Application Database", group: "Core infrastructure", description: "Runs a live application database query." },
  { id: "authentication", name: "Authentication", group: "Core infrastructure", description: "Checks the authenticated session and access authorization." },
  { id: "website", name: "Website / API", group: "Core infrastructure", description: "Inspects the local Next.js system service." },
  { id: "worker", name: "Video & Podcast Worker", group: "Media processing", description: "Checks the actual Viewers Tube worker system service that processes video jobs and podcast thumbnails." },
  { id: "workerHeartbeat", name: "Processing Worker Heartbeat", group: "Media processing", description: "Independently checks the worker's database heartbeat, last-seen timestamp and age." },
  { id: "videos", name: "Video Pipeline", group: "Media processing", description: "Counts video records and failed or processing videos in your permitted scope." },
  { id: "podcasts", name: "Podcast Pipeline", group: "Media processing", description: "Counts podcast episodes and failures. Thumbnail processing runs inside the shared worker." },
  { id: "storage", name: "Backblaze B2 Connections", group: "Storage", description: "Checks saved storage connection records and error states." },
  { id: "nativeLibrary", name: "Native Video Library", group: "Media delivery", description: "Runs the public library query and verifies storage and creator eligibility filters." },
  { id: "revive", name: "Revive Adserver", group: "Advertising", description: "Checks the Revive service and its local HTTP endpoint." },
  { id: "reviveDatabase", name: "Revive Database", group: "Advertising", description: "Inspects the exact revive-local-db container." },
  { id: "cloudflare", name: "Cloudflare Production", group: "External integrations", description: "Checks the live Cloudflare Workers production endpoint." },
  { id: "mediamtx", name: "MediaMTX / Live", group: "External integrations", description: "Checks the MediaMTX container health and local API." },
  { id: "github", name: "GitHub", group: "External integrations", description: "Checks the configured GitHub repository's availability and archive status." },
  { id: "nodeRuntime", name: "Node.js Runtime", group: "System Diagnostics", description: "Checks Node.js version, uptime, platform and memory." },
  { id: "nextFramework", name: "Next.js Framework", group: "System Diagnostics", description: "Checks the installed Next.js version and probes the live homepage and health API route." },
  { id: "browserErrors", name: "Browser Console & Client Errors", group: "System Diagnostics", description: "Captures browser exceptions, rejected promises, failed network requests and HTTP 5xx responses for the signed-in account." },
  { id: "apiRuntime", name: "API & Runtime Requests", group: "System Diagnostics", description: "Probes live health and Native Library API endpoints, including HTTP status and response time." },
];

const creatorAllowedComponents: ComponentId[] = [
  "videos", "podcasts", "storage", "nativeLibrary", "browserErrors", "apiRuntime",
];

const colors: Record<string, string> = {
  healthy: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
  warning: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  error: "border-red-400/40 bg-red-400/10 text-red-200",
  unknown: "border-white/15 bg-white/5 text-slate-300",
  unverified: "border-violet-400/30 bg-violet-400/10 text-violet-200",
};

function statusLabel(status: string) {
  return ({
    healthy: "Healthy",
    warning: "Attention",
    error: "Error",
    unknown: "Unknown",
    unverified: "Not verified",
    assessment: "Assessment only",
    analysis: "Read-only analysis",
  })[status] ?? status;
}

const hostDiagnosticComponents = new Set<ComponentId>([
  "website", "worker", "workerHeartbeat", "nextFramework", "apiRuntime",
  "revive", "reviveDatabase", "mediamtx",
]);

type ComponentResult = {
  status?: string;
  title?: string;
  detail?: string;
  issues?: string[];
  suggestions?: string[];
  evidence?: { detail?: string; status?: string };
  changed?: boolean;
  error?: string;
  repairOptions?: RepairOption[];
};

async function requestComponent(component: ComponentId, action: Action): Promise<ComponentResult> {
  const isLocalAgentEnvironment =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) &&
    ["3001", "8787"].includes(window.location.port);

  const useLocalAgent =
    isLocalAgentEnvironment &&
    hostDiagnosticComponents.has(component) &&
    (action === "fix" || (action === "diagnose" && !["workerHeartbeat", "nextFramework", "apiRuntime"].includes(component)));

  if (useLocalAgent) {
    if (action === "fix" && !window.confirm(
      `Restart the local ${component} component? This may briefly interrupt its service.`
    )) {
      return {
        status: "assessment",
        title: "Repair cancelled",
        detail: "No service or container was changed.",
        changed: false,
      };
    }

    const tokenResponse = await fetch("/api/repair-centre/local-diagnostic-token", {
      method: "POST",
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error("Administrator token unavailable.");
    const tokenData = await tokenResponse.json() as { token?: string };
    if (!tokenData.token) throw new Error("Diagnostic token missing.");

    const response = await fetch(
      `http://127.0.0.1:8091/${action === "fix" ? "repair" : "diagnose"}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenData.token}`,
        },
        body: JSON.stringify(action === "fix"
          ? { component, confirm: "RESTART_LOCAL_COMPONENT" }
          : { component }),
        cache: "no-store",
      }
    );
    const data = await response.json() as ComponentResult;
    if (!response.ok) throw new Error(data.error ?? `Local agent HTTP ${response.status}.`);
    return data;
  }

  const response = await fetch("/api/repair-centre/component", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ component, action }),
    cache: "no-store",
  });
  const data = await response.json() as ComponentResult;
  if (!response.ok) throw new Error(data.error ?? data.detail ?? "Component action failed.");
  return data;
}

export function RepairArchitectureMap({ role, checks, metrics, onRefresh, scanId = 0, onScanStateChange }: Props) {
  const visibleDefinitions = useMemo(() => role === "ADMIN" ? definitions : definitions.filter((node) => creatorAllowedComponents.includes(node.id)), [role]);
  const [selected, setSelected] = useState<ComponentId>(role === "ADMIN" ? "database" : "videos");
  const [results, setResults] = useState<Record<string, {
    status?: string;
    title?: string;
    detail?: string;
    issues?: string[];
    suggestions?: string[];
    evidence?: { detail?: string; status?: string };
    changed?: boolean;
    error?: string;
    repairOptions?: RepairOption[];
  }>>({});
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ completed: 0, total: visibleDefinitions.length });

  useEffect(() => {
    if (scanId === 0) return;
    let cancelled = false;

    const runAll = async () => {
      setScanning(true);
      setScanProgress({ completed: 0, total: visibleDefinitions.length });
      setError("");
      onScanStateChange?.(true);
      let completed = 0;

      await Promise.all(visibleDefinitions.map(async (node) => {
        try {
          const data = await requestComponent(node.id, "diagnose");
          if (!cancelled) {
            setResults((previous) => ({ ...previous, [node.id]: data }));
          }
        } catch (cause) {
          if (!cancelled) {
            setResults((previous) => ({
              ...previous,
              [node.id]: {
                status: "error",
                title: "Diagnostic request failed",
                detail: cause instanceof Error ? cause.message : "Unable to check this component.",
                issues: ["This component could not be diagnosed during the full scan."],
              },
            }));
          }
        } finally {
          completed += 1;
          if (!cancelled) {
            setScanProgress({ completed, total: visibleDefinitions.length });
          }
        }
      }));

      if (!cancelled) {
        setScanning(false);
        onScanStateChange?.(false);
        await onRefresh?.();
      }
    };

    void runAll();
    return () => {
      cancelled = true;
      onScanStateChange?.(false);
    };
  }, [scanId, visibleDefinitions, onRefresh, onScanStateChange]);

  const active = visibleDefinitions.find((item) => item.id === selected) ?? visibleDefinitions[0];
  const result = results[active.id];
  const selectedCheck = active.id === "workerHeartbeat"
    ? checks?.worker
    : active.id === "worker"
      ? undefined
      : checks?.[active.id];

  const initialStatus = selectedCheck?.status ??
    (active.id === "videos" && (metrics?.failedVideos || metrics?.failedJobs) ? "warning" :
    active.id === "podcasts" && metrics?.failedEpisodes ? "warning" :
    active.id === "storage" && metrics?.storageErrors ? "error" : "unknown");
  const status = result?.status ?? initialStatus;

  async function runAction(action: Action) {
    setBusy(action);
    setError("");
    try {
      if (action === "fix" && (active.id === "videos" || active.id === "storage")) {
        const diagnosis = await requestComponent(active.id, "diagnose");
        const options = diagnosis.repairOptions ?? [];
        const eligible = options.filter((option) =>
          option.kind === "storage" ||
          (option.kind === "video" && (option.attempts ?? 0) < 3)
        );

        if (eligible.length === 0) {
          setResults((previous) => ({
            ...previous,
            [active.id]: {
              ...diagnosis,
              title: "No eligible repairs",
              detail: options.length
                ? "Video retry limits have been reached. Administrator investigation is required."
                : "No eligible repair items were found. No changes were made.",
              changed: false,
            },
          }));
          return;
        }

        const videoCount = eligible.filter((item) => item.kind === "video").length;
        if (videoCount && !window.confirm(
          `Queue ${videoCount} eligible video retry job(s)? The three-attempt limit and server-side cooldown remain enforced.`
        )) return;

        const outcomes: string[] = [];
        const failures: string[] = [];

        for (const option of eligible) {
          try {
            const response = await fetch(
              option.kind === "video"
                ? "/api/repair-centre/retry-video"
                : "/api/repair-centre/verify-storage",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                  option.kind === "video"
                    ? { jobId: option.id }
                    : { connectionId: option.id }
                ),
              }
            );
            const result = await response.json() as { message?: string; error?: string };
            if (!response.ok) {
              throw new Error(result.error || result.message || `HTTP ${response.status}`);
            }
            outcomes.push(result.message || `${option.label}: accepted.`);
          } catch (cause) {
            failures.push(`${option.label}: ${cause instanceof Error ? cause.message : "Repair failed."}`);
          }
        }

        setResults((previous) => ({
          ...previous,
          [active.id]: {
            ...diagnosis,
            title: failures.length ? "Repair completed with errors" : "Repair actions completed",
            detail: [
              `${outcomes.length} action(s) accepted; ${failures.length} failed.`,
              ...outcomes,
              ...failures,
            ].join(" "),
            issues: failures,
            changed: outcomes.length > 0,
          },
        }));
        await onRefresh?.();
        return;
      }

      const data = await requestComponent(active.id, action);
      setResults((previous) => ({ ...previous, [active.id]: data }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete component action.");
    } finally {
      setBusy(null);
    }
  }

  async function runRepairOption(option: RepairOption) {
    if (option.kind === "video") {
      if ((option.attempts ?? 0) >= 3) {
        setError("This job has reached the three-attempt retry limit.");
        return;
      }
      if (!window.confirm(
        `Retry transcoding for "${option.label}"? Derived renditions may be regenerated. The original upload will not be deleted.`
      )) return;
    } else if (option.kind !== "storage") {
      setError("No supported repair action is available for this item.");
      return;
    }

    setBusy("fix");
    setError("");
    try {
      const response = await fetch(
        option.kind === "video"
          ? "/api/repair-centre/retry-video"
          : "/api/repair-centre/verify-storage",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            option.kind === "video"
              ? { jobId: option.id }
              : { connectionId: option.id }
          ),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || "The selected repair action failed.");
      }
      setResults((previous) => ({
        ...previous,
        [active.id]: {
          ...previous[active.id],
          title: option.kind === "video" ? "Video retry queued" : "Storage verification completed",
          detail: data.message || "The selected action was accepted.",
          changed: true,
        },
      }));
      await onRefresh?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The selected repair action failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#101a2b] to-[#0b1020] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Component diagnostics</p>
          <h2 className="mt-1 text-xl font-bold">Viewers Tube architecture</h2>
          <p className="mt-1 text-sm text-slate-400">Run diagnostics checks every component automatically. Select any component for its individual actions.</p>
        </div>
        <span className="rounded-full border border-cyan-300/20 px-3 py-1 text-xs text-cyan-200">Live action panel</span>
      </div>

      {scanning && (
        <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-3" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-cyan-100">Checking all components…</span>
            <span className="tabular-nums text-slate-300">
              {scanProgress.completed}/{scanProgress.total}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-cyan-300 transition-all"
              style={{ width: `${(scanProgress.completed / scanProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleDefinitions.map((node) => {
          const chosen = active.id === node.id;
          const checkForNode = node.id === "workerHeartbeat"
            ? checks?.worker
            : checks?.[node.id];
          const nodeStatus = results[node.id]?.status ?? checkForNode?.status ?? "unknown";
          return (
            <button
              key={node.id}
              type="button"
              onClick={() => { setSelected(node.id); setError(""); }}
              aria-pressed={chosen}
              className={`rounded-xl border p-4 text-left transition ${colors[nodeStatus] ?? colors.unknown} ${chosen ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-[#101a2b]" : "hover:border-cyan-300/60"}`}
            >
              <span className="block text-[10px] uppercase tracking-wider opacity-70">{node.group}</span>
              <span className="mt-2 block font-semibold">{node.name}</span>
              <span className="mt-2 block text-xs">{statusLabel(nodeStatus)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{active.name}</h3>
          <span className={`rounded-full border px-3 py-1 text-xs ${colors[status] ?? colors.unknown}`}>
            {statusLabel(status)}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-300">{active.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["diagnose", "issues", "fix", "optimize"] as Action[]).map((action) => (
            <button
              key={action}
              type="button"
              disabled={busy !== null || scanning}
              onClick={() => void runAction(action)}
              className="rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-wait disabled:opacity-50"
            >
              {busy === action ? "Working…" : action === "issues" ? "Issues / Errors" : action[0].toUpperCase() + action.slice(1)}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        {result && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-semibold">{result.title ?? "Component result"}</p>
            <p className="mt-1 text-sm text-slate-300">{result.detail ?? result.error}</p>
            {result.issues && result.issues.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-200">
                {result.issues.map((issue, index) => <li key={index}>{issue}</li>)}
              </ul>
            )}
            {result.suggestions && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-300">
                {result.suggestions.map((suggestion, index) => <li key={index}>{suggestion}</li>)}
              </ul>
            )}
            {result.evidence?.detail && (
              <p className="mt-2 text-xs text-slate-400">Evidence: {result.evidence.detail}</p>
            )}
            {result.repairOptions && result.repairOptions.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="text-xs font-semibold text-slate-200">
                  {active.id === "videos" ? "Eligible failed video jobs" : "Storage connections to verify"}
                </p>
                <ul className="mt-2 space-y-2">
                  {result.repairOptions.map((option) => (
                    <li key={option.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-black/20 p-2">
                      <span className="min-w-0 text-xs text-slate-300">
                        {option.label}
                        {option.kind === "video" ? ` · attempts ${option.attempts ?? 0}/3` : ` · ${option.status ?? "status unknown"}`}
                      </span>
                      <button
                        type="button"
                        disabled={busy !== null || scanning || (option.kind === "video" && (option.attempts ?? 0) >= 3)}
                        onClick={() => void runRepairOption(option)}
                        className="rounded-md border border-cyan-300/30 px-2 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-300/10 disabled:opacity-40"
                      >
                        {busy === "fix"
                          ? "Working…"
                          : option.kind === "video" ? "Retry this job" : "Verify this connection"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.changed === false && (
              <p className="mt-2 text-[11px] text-slate-500">Read-only: no service, configuration, or production data was changed.</p>
            )}
          </div>
        )}

        {active.id === "videos" && (
          <p className="mt-3 text-xs text-slate-400">
            Total: {metrics?.totalVideos ?? "—"} · Failed: {metrics?.failedVideos ?? "—"} · Processing: {metrics?.processingVideos ?? "—"} · Failed jobs: {metrics?.failedJobs ?? "—"}
          </p>
        )}
        {active.id === "podcasts" && (
          <p className="mt-3 text-xs text-slate-400">
            Episodes: {metrics?.totalEpisodes ?? "—"} · Failed: {metrics?.failedEpisodes ?? "—"} · Uploading: {metrics?.uploadingEpisodes ?? "—"}
          </p>
        )}
        {active.id === "storage" && (
          <p className="mt-3 text-xs text-slate-400">
            Connections: {metrics?.totalStorage ?? "—"} · Errors: {metrics?.storageErrors ?? "—"}
          </p>
        )}
        {active.id === "worker" && (
          <p className="mt-3 text-xs text-slate-400">
            Queued jobs: {metrics?.pendingJobs ?? "—"} · Running jobs: {metrics?.runningJobs ?? "—"}
          </p>
        )}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        External checks verify the public Cloudflare Worker, MediaMTX container and API, and public GitHub repository. They do not verify authenticated account permissions or deployment workflows. Fix performs a safety assessment only; it never restarts services or changes production settings.
      </p>
    </section>
  );
}
