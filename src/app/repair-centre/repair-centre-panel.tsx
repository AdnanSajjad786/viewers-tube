"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RepairArchitectureMap } from "./repair-architecture-map";

type Report = {
  checkedAt: string;
  scope: string;
  role: string;
  displayName: string;
  checks: {
    database: { status: string; label: string };
    authentication: { status: string; label: string };
    worker: { status: string; label: string; detail: string };
  };
  metrics: Record<string, number>;
  issues: Array<{
    severity: string;
    title: string;
    detail: string;
  }>;
  recentFailures: Array<{
    id: string;
    title: string;
    attempts: number;
    updatedAt: string;
  }>;
  recentHistory: Array<{
    id: string;
    actorRole: string;
    action: string;
    status: string;
    targetType: string | null;
    summary: string;
    createdAt: string;
  }>;
  incidents: Array<{
    id: string;
    source: string;
    severity: string;
    status: string;
    title: string;
    detail: string;
    errorCode: string | null;
    targetId: string | null;
    occurrences: number;
    firstSeenAt: string;
    lastSeenAt: string;
    resolvedAt: string | null;
  }>;
  storageConnections: Array<{
    id: string;
    label: string;
    region: string;
    bucketName: string;
    prefix: string;
    status: string;
    verifiedAt: string | null;
  }>;
};

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

export function RepairCentrePanel({ role }: { role: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanId, setScanId] = useState(0);
  const [scanBusy, setScanBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [verifyingStorageId, setVerifyingStorageId] = useState("");
  const [storageMessage, setStorageMessage] = useState("");
  const [repairingIncidentId, setRepairingIncidentId] = useState("");
  const [incidentClearBusy, setIncidentClearBusy] = useState(false);
  const [incidentMessage, setIncidentMessage] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyMessage, setHistoryMessage] = useState("");
  const [retentionPreview, setRetentionPreview] = useState<{
    mode: string;
    retentionDays: number;
    cutoff: string;
    eligibleResolved: number;
    retainedResolved: number;
    preservedOpen: number;
    deleted: number;
    message: string;
  } | null>(null);
  const [retentionError, setRetentionError] = useState("");


  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/repair-centre", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not run diagnostics.");
      }

      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnostics failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const runFullDiagnostics = useCallback(async () => {
    await load();
    setScanId((current) => current + 1);
  }, [load]);

  const handleScanStateChange = useCallback((busy: boolean) => {
    setScanBusy(busy);
  }, []);

  useEffect(() => {
    // Initial overview load; full component checks run on button click.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (role !== "ADMIN") return;

    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/repair-centre/incidents/retention", {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Retention preview unavailable.");
        if (active) setRetentionPreview(data);
      } catch (err) {
        if (active) setRetentionError(
          err instanceof Error ? err.message : "Retention preview unavailable."
        );
      }
    })();

    return () => { active = false; };
  }, [role]);

  const retryJob = async (jobId: string, title: string) => {
    if (!window.confirm(
      `Retry transcoding for "${title}"? The worker may regenerate this video's derived renditions. The original upload will not be deleted.`
    )) return;

    setRetryingId(jobId);
    setActionMessage("");

    try {
      const response = await fetch("/api/repair-centre/retry-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not queue the retry.");
      }

      setActionMessage(data.message || "Retry queued.");
      await load();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Retry failed.");
    } finally {
      setRetryingId("");
    }
  };

  const verifyStorage = async (connectionId: string) => {
    setVerifyingStorageId(connectionId);
    setStorageMessage("");

    try {
      const response = await fetch("/api/repair-centre/verify-storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const data = await response.json();

      if (!response.ok) {
        const cause = data.cause ? ` [${data.cause}]` : "";
        throw new Error((data.message || data.error || "Storage verification failed.") + cause);
      }

      setStorageMessage(data.message || "Storage connection verified.");
      await load();
    } catch (err) {
      setStorageMessage(err instanceof Error ? err.message : "Storage verification failed.");
      await load();
    } finally {
      setVerifyingStorageId("");
    }
  };


  const repairIncident = async (incidentId: string) => {
    setRepairingIncidentId(incidentId);
    setActionMessage("");

    try {
      const response = await fetch("/api/repair-centre/repair-incident", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Incident verification failed.");
      }

      setActionMessage(data.message || "Incident resolved after verification.");
      await load();
    } catch (err) {
      setActionMessage(
        err instanceof Error ? err.message : "Incident verification failed."
      );
      await load();
    } finally {
      setRepairingIncidentId("");
    }
  };

  const clearResolvedIncidents = async () => {
    const resolvedCount = report?.incidents.filter(
      (incident) => incident.status === "RESOLVED"
    ).length ?? 0;

    if (resolvedCount === 0 || !window.confirm(
      `Clear all resolved runtime incidents in your permitted scope? Open incidents will not be deleted. This cannot be undone.`
    )) return;

    setIncidentClearBusy(true);
    setIncidentMessage("");

    try {
      const response = await fetch("/api/repair-centre/incidents/clear-resolved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not clear resolved incidents.");
      }

      setIncidentMessage(data.message || "Resolved incidents cleared.");
      await load();
    } catch (err) {
      setIncidentMessage(
        err instanceof Error ? err.message : "Could not clear resolved incidents."
      );
    } finally {
      setIncidentClearBusy(false);
    }
  };

  const manageHistory = async (action: "delete" | "clear", id?: string) => {
    const prompt = action === "clear"
      ? "Clear all repair history entries in your permitted scope? This cannot be undone."
      : "Delete this repair history entry? This cannot be undone.";

    if (!window.confirm(prompt)) return;

    setHistoryBusy(true);
    setHistoryMessage("");

    try {
      const response = await fetch("/api/repair-centre/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(id ? { id } : {}) }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "History action failed.");

      setHistoryMessage(data.message || "Repair history updated.");
      await load();
    } catch (err) {
      setHistoryMessage(err instanceof Error ? err.message : "History action failed.");
    } finally {
      setHistoryBusy(false);
    }
  };

  const metrics = report?.metrics;

  return (
    <main className="min-h-screen bg-[#080b13] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap gap-4 text-sm text-cyan-300">
          <Link href="/">← Viewers Tube</Link>
          <Link href="/studio">Studio</Link>
          {role === "ADMIN" && <Link href="/admin">Admin dashboard</Link>}
        </nav>

        <header className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
              Viewers Tube / System tools
            </p>
            <h1 className="mt-2 text-3xl font-bold">Repair Centre</h1>
            <p className="mt-2 text-sm text-slate-400">
              {role === "ADMIN"
                ? "Platform-wide diagnostics and processing health."
                : "Diagnostics for your own videos, podcasts and uploads."}
            </p>
          </div>

          <button
            onClick={() => void runFullDiagnostics()}
            disabled={loading || scanBusy}
            className="rounded-lg border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-300/10 disabled:opacity-50"
          >
            {scanBusy ? "Scanning components…" : loading ? "Refreshing overview…" : "Run diagnostics"}
          </button>
        </header>

        {report && <RepairArchitectureMap
            role={report.role}
            checks={report.checks}
            metrics={report.metrics}
            onRefresh={load}
            scanId={scanId}
            onScanStateChange={handleScanStateChange}
          />}

        <section className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            report?.checks.database,
            report?.checks.authentication,
            report?.checks.worker,
          ].filter(Boolean).map((check) => (
            <div key={check!.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm text-slate-400">{check!.label}</p>
              <p className={`mt-2 font-semibold ${
                check!.status === "healthy"
                  ? "text-emerald-300"
                  : check!.status === "warning"
                    ? "text-amber-300"
                    : check!.status === "error"
                      ? "text-red-300"
                      : "text-slate-300"
              }`}>
                {check!.status === "healthy"
                  ? "Healthy"
                  : check!.status === "warning"
                    ? "Delayed"
                    : check!.status === "error"
                      ? "Stale / unavailable"
                      : "Unknown"}
              </p>
              {"detail" in check! && (
                <p className="mt-2 text-xs text-slate-400">{String(check!.detail)}</p>
              )}
            </div>
          ))}
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {metrics && (
          <>
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold">
                {role === "ADMIN" ? "Platform overview" : "Your content overview"}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                <Metric label="Videos" value={metrics.totalVideos} />
                <Metric label="Failed videos" value={metrics.failedVideos} />
                <Metric label="Processing videos" value={metrics.processingVideos} />
                <Metric label="Failed transcode jobs" value={metrics.failedJobs} />
                <Metric label="Queued jobs" value={metrics.pendingJobs} />
                <Metric label="Running jobs" value={metrics.runningJobs} />
                <Metric label="Podcast episodes" value={metrics.totalEpisodes} />
                <Metric label="Failed episodes" value={metrics.failedEpisodes} />
                <Metric label="Uploading episodes" value={metrics.uploadingEpisodes} />
                <Metric label="Storage connections" value={metrics.totalStorage} />
                <Metric label="Storage errors" value={metrics.storageErrors} />
              </div>
            </section>

            <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold">Storage connection verification</h2>
              <p className="mt-1 text-sm text-slate-400">
                Checks saved credentials and bucket-list access without uploading, changing or deleting files.
              </p>
              {report.storageConnections.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No saved storage connections found.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/10">
                  {report.storageConnections.map((connection) => (
                    <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                      <div className="min-w-0">
                        <p className="font-medium">{connection.label || connection.bucketName}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          Bucket: {connection.bucketName} · Region: {connection.region}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Folder: {connection.prefix || "(bucket root)"} · Status: {connection.status}
                        </p>
                        {connection.verifiedAt && (
                          <p className="mt-1 text-xs text-slate-500">
                            Last verified: {new Date(connection.verifiedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void verifyStorage(connection.id)}
                        disabled={verifyingStorageId !== ""}
                        className="rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {verifyingStorageId === connection.id ? "Verifying…" : "Verify connection"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {storageMessage && (
                <p role="status" className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-cyan-200">
                  {storageMessage}
                </p>
              )}
            </section>

            <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Runtime incidents</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-400">
                    {report.incidents.filter((item) => item.status === "OPEN").length} open
                  </span>
                  {report.incidents.some((item) => item.status === "RESOLVED") && (
                    <button
                      type="button"
                      onClick={() => void clearResolvedIncidents()}
                      disabled={incidentClearBusy || repairingIncidentId !== ""}
                      className="rounded-lg border border-amber-300/30 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {incidentClearBusy ? "Clearing…" : "Clear resolved incidents"}
                    </button>
                  )}
                </div>
              </div>
              {report.incidents.length === 0 ? (
                <p className="mt-3 text-sm text-emerald-300">
                  No recorded runtime incidents in your permitted scope.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-white/10">
                  {report.incidents.map((incident) => (
                    <li key={incident.id} className="py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{incident.title}</p>
                        <span className={`rounded-md border px-2 py-1 text-xs ${
                          incident.status === "OPEN"
                            ? "border-red-300/30 text-red-300"
                            : "border-emerald-300/30 text-emerald-300"
                        }`}>
                          {incident.status}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        {incident.status === "RESOLVED" &&
                        incident.detail.toLowerCase().includes("incident remains open")
                          ? "This incident was subsequently resolved after verification. " +
                            incident.detail.replace(/manual verification did not pass; the incident remains open\.?/i, "").trim()
                          : incident.detail}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {incident.source.replaceAll("_", " ")}
                        {" · "}
                        Cause: {incident.errorCode || "Unclassified"}
                        {" · "}
                        Occurrences: {incident.occurrences}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Last seen: {new Date(incident.lastSeenAt).toLocaleString()}
                      </p>
                      {incident.status === "OPEN" && (
                        <button
                          type="button"
                          onClick={() => void repairIncident(incident.id)}
                          disabled={repairingIncidentId !== ""}
                          className="mt-3 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {repairingIncidentId === incident.id
                            ? "Verifying…"
                            : "Verify and repair"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {incidentMessage && (
              <p role="status" className="mt-3 text-sm text-cyan-200">
                {incidentMessage}
              </p>
            )}

            <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold">Diagnostic findings</h2>
              {report.issues.length === 0 ? (
                <p className="mt-3 text-sm text-emerald-300">
                  No processing or storage issues were detected in the checked records.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {report.issues.map((issue, index) => (
                    <li key={`${issue.title}-${index}`} className="border-b border-white/10 pb-3 last:border-0">
                      <p className={issue.severity === "warning" ? "font-semibold text-amber-300" : "font-semibold text-cyan-200"}>
                        {issue.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">{issue.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">Repair history</h2>
                <button
                  type="button"
                  onClick={() => void manageHistory("clear")}
                  disabled={historyBusy || report.recentHistory.length === 0}
                  className="rounded-lg border border-red-300/25 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {historyBusy ? "Working…" : "Clear visible history"}
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {role === "ADMIN"
                  ? "Admin scope: all repair history entries."
                  : "Creator scope: only your own repair history entries."}
              </p>
              {role === "ADMIN" && (
                <div className="mt-4 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.04] p-4">
                  <h3 className="font-semibold text-cyan-200">Incident retention preview</h3>
                  {retentionError ? (
                    <p role="status" className="mt-2 text-sm text-amber-200">{retentionError}</p>
                  ) : retentionPreview ? (
                    <>
                      <p className="mt-1 text-xs text-slate-400">
                        Read-only preview · {retentionPreview.retentionDays}-day resolved-incident retention ·
                        cutoff {new Date(retentionPreview.cutoff).toLocaleString()}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div><p className="text-xs text-slate-400">Eligible resolved</p><p className="text-xl font-semibold tabular-nums">{retentionPreview.eligibleResolved}</p></div>
                        <div><p className="text-xs text-slate-400">Retained resolved</p><p className="text-xl font-semibold tabular-nums">{retentionPreview.retainedResolved}</p></div>
                        <div><p className="text-xs text-slate-400">Open protected</p><p className="text-xl font-semibold tabular-nums">{retentionPreview.preservedOpen}</p></div>
                        <div><p className="text-xs text-slate-400">Deleted</p><p className="text-xl font-semibold tabular-nums">{retentionPreview.deleted}</p></div>
                      </div>
                      <p className="mt-3 text-xs text-slate-400">{retentionPreview.message}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-slate-400">Loading retention preview…</p>
                  )}
                </div>
              )}
              {report.recentHistory.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">
                  No repair actions have been recorded yet.
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-white/10">
                  {report.recentHistory.map((event) => (
                    <li key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{event.action.replaceAll("_", " ")}</span>
                          <span className="rounded-md border border-cyan-300/20 px-2 py-1 text-xs text-cyan-200">
                            {event.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{event.summary}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {event.actorRole} · {event.targetType || "SYSTEM"} · {new Date(event.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void manageHistory("delete", event.id)}
                        disabled={historyBusy}
                        className="rounded-lg border border-red-300/25 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {historyMessage && (
                <p role="status" className="mt-3 text-sm text-cyan-200">{historyMessage}</p>
              )}
            </section>

            <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold">Recent failed video jobs</h2>
              {report.recentFailures.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">No failed video jobs found.</p>
              ) : (
                <ul className="mt-3 divide-y divide-white/10">
                  {report.recentFailures.map((job) => (
                    <li key={job.id} className="py-3">
                      <p className="font-medium">{job.title}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Attempts: {job.attempts} · Updated: {new Date(job.updatedAt).toLocaleString()}
                      </p>
                      <button
                        type="button"
                        onClick={() => void retryJob(job.id, job.title)}
                        disabled={retryingId !== "" || job.attempts >= 3}
                        className="mt-3 rounded-lg border border-cyan-300/30 px-3 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {retryingId === job.id
                          ? "Queueing…"
                          : job.attempts >= 3
                            ? "Attempt limit reached"
                            : "Retry transcode"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {actionMessage && (
              <p role="status" className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-cyan-200">
                {actionMessage}
              </p>
            )}

            <p className="mt-6 text-xs text-slate-500">
              Last checked: {new Date(report.checkedAt).toLocaleString()}.
              The worker service and its database heartbeat are checked separately; heartbeat freshness is shown in the Processing Worker Heartbeat component.
            </p>
          </>
        )}

        <p className="mt-8 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-xs leading-6 text-slate-400">
          Safe repair mode. Failed video transcodes can be retried manually,
          subject to ownership checks, a 30-second cooldown and a three-attempt limit.
          A retry may regenerate derived renditions; original uploads are preserved.
          No service restarts, credential changes or destructive database operations are performed.
          Creator actions are restricted to the signed-in Creator&apos;s own channel.
        </p>
      </div>
    </main>
  );
}
