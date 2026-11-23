import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { headers } from "next/headers";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const services = {
  website: "viewers-tube-web.service",
  worker: "viewers-tube-worker.service",
  revive: "revive-adserver.service",
} as const;

type Component =
  | "database" | "authentication" | "website" | "worker" | "workerHeartbeat"
  | "videos" | "podcasts" | "storage" | "nativeLibrary" | "revive"
  | "reviveDatabase" | "cloudflare" | "mediamtx" | "github" | "nodeRuntime" | "nextFramework" | "browserErrors" | "apiRuntime";

type Action = "diagnose" | "issues" | "fix" | "optimize";


type RemoteHostComponent =
  | "website"
  | "worker"
  | "revive"
  | "reviveDatabase"
  | "mediamtx";

async function inspectRemoteHost(component: RemoteHostComponent) {
  let env: CloudflareEnv;

  try {
    ({ env } = await getCloudflareContext({ async: true }));
  } catch {
    // Ordinary local Next.js development keeps its existing local inspection.
    return null;
  }

  const remoteEnv = env as CloudflareEnv & { VIEWERS_TUBE_DIAGNOSTICS?: { fetch: typeof fetch }; LOCAL_DIAGNOSTICS_TOKEN?: string };
  const binding = remoteEnv.VIEWERS_TUBE_DIAGNOSTICS;
  const secret = remoteEnv.LOCAL_DIAGNOSTICS_TOKEN;

  if (!binding || !secret || secret.length < 32) {
    return {
      status: "unverified",
      detail: "Remote Linux diagnostics are not configured: the VPC binding or diagnostic secret is unavailable.",
      issues: ["Verify the Cloudflare VPC binding and matching LOCAL_DIAGNOSTICS_TOKEN secret."],
    };
  }

  try {
    const origin = "http://localhost:3001";
    const expires = String(Date.now() + 30_000);
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${expires}.${origin}`)
    );
    const signature = Array.from(new Uint8Array(signatureBytes))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const response = await binding.fetch(
      "http://127.0.0.1:8091/diagnose",
      {
        method: "POST",
        headers: {
          Origin: origin,
          Authorization: `Bearer ${expires}.${signature}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ component }),
        signal: AbortSignal.timeout(12_000),
      }
    );

    if (!response.ok) {
      return {
        status: "error",
        detail: `Remote Linux diagnostic returned HTTP ${response.status}.`,
        issues: ["Check the Cloudflare Tunnel, VPC service, and diagnostic agent logs."],
      };
    }

    const data = await response.json() as {
      status?: unknown;
      detail?: unknown;
      issues?: unknown;
    };

    const validStatuses = ["healthy", "warning", "error", "unknown", "unverified"];
    if (
      typeof data.status !== "string" ||
      !validStatuses.includes(data.status) ||
      typeof data.detail !== "string"
    ) {
      return {
        status: "error",
        detail: "Remote diagnostic returned an invalid response.",
        issues: ["Check the Linux diagnostic agent response."],
      };
    }

    return {
      status: data.status,
      detail: data.detail,
      issues: Array.isArray(data.issues)
        ? data.issues.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch (error) {
    return {
      status: "error",
      detail: `Remote Linux diagnostic failed: ${error instanceof Error ? error.message : "Connection error"}`,
      issues: ["Check the Cloudflare Tunnel, VPC service, shared secret, and Linux diagnostic agent."],
    };
  }
}

function isUnsupportedHostInspection(error: unknown) {
  return error instanceof Error &&
    /child_process\.execFile method is not implemented/i.test(error.message);
}

function unavailableHostCheck(kind: string) {
  return {
    status: "unverified",
    detail: `${kind} inspection is not available in this runtime. Host-level checks are available only on the Linux server.`,
    observable: false,
  };
}

async function serviceStatus(service: string) {
  try {
    const { stdout } = await execFileAsync(
      "systemctl",
      ["show", service, "--property=ActiveState", "--property=SubState", "--no-pager"],
      { timeout: 5000, maxBuffer: 16 * 1024 }
    );
    const values = Object.fromEntries(
      stdout.trim().split("\n").map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
    );
    const active = values.ActiveState === "active";
    return {
      status: active ? "healthy" : values.ActiveState === "inactive" ? "error" : "warning",
      detail: `${service}: ${values.ActiveState ?? "unknown"} (${values.SubState ?? "unknown"})`,
      observable: true,
    };
  } catch (error) {
    if (isUnsupportedHostInspection(error)) return unavailableHostCheck("Systemd service");
    return {
      status: "unknown",
      detail: `Service status could not be read: ${error instanceof Error ? error.message : "permission or systemctl error"}`,
      observable: false,
    };
  }
}

async function containerStatus() {
  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["inspect", "revive-local-db", "--format", "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}"],
      { timeout: 5000, maxBuffer: 16 * 1024 }
    );
    const value = stdout.trim();
    const running = value.startsWith("running");
    const healthy = value.includes(" healthy");
    return {
      status: !running ? "error" : healthy ? "healthy" : "warning",
      detail: `revive-local-db: ${value}`,
      observable: true,
    };
  } catch (error) {
    if (isUnsupportedHostInspection(error)) return unavailableHostCheck("Docker container");
    return {
      status: "unknown",
      detail: `Container status could not be read: ${error instanceof Error ? error.message : "Docker access error"}`,
      observable: false,
    };
  }
}



async function inspect(component: Component, userId: string, role: string) {
  if (component === "website") return serviceStatus(services.website);
  if (component === "worker") return serviceStatus(services.worker);
  if (component === "revive") return serviceStatus(services.revive);
  if (component === "reviveDatabase") return containerStatus();
  if (component === "mediamtx") return unavailableHostCheck("MediaMTX container");

  if (component === "database") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "healthy", detail: "Application database query succeeded." };
    } catch {
      return { status: "error", detail: "Application database query failed." };
    }
  }

  if (component === "authentication") {
    return { status: "healthy", detail: "Authenticated session and role authorization succeeded." };
  }


  if (component === "workerHeartbeat") {
    const heartbeat = await prisma.workerHeartbeat.findUnique({
      where: { id: "transcode-worker" },
      select: { lastSeenAt: true },
    });

    if (!heartbeat) {
      return {
        status: "error",
        detail: "No processing worker heartbeat record exists.",
        issues: ["The worker has not recorded a heartbeat. Inspect the worker service logs."],
      };
    }

    const age = Math.max(
      0,
      Math.round((Date.now() - heartbeat.lastSeenAt.getTime()) / 1000)
    );
    const status = age <= 45 ? "healthy" : age <= 120 ? "warning" : "error";

    return {
      status,
      detail: `Last heartbeat: ${heartbeat.lastSeenAt.toISOString()} (${age} seconds ago).`,
      lastSeenAt: heartbeat.lastSeenAt.toISOString(),
      ageSeconds: age,
      issues: status === "healthy"
        ? []
        : [`Worker heartbeat is ${age} seconds old. Inspect the worker service and its logs.`],
    };
  }

  if (component === "nativeLibrary") {
    try {
      const videos = await prisma.video.findMany({
        where: { status: "READY", visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          storageConnection: { select: { status: true } },
          channel: {
            select: {
              owner: { select: { creatorTerminatedAt: true } },
            },
          },
        },
      });

      const available = videos.filter(
        (video) =>
          video.storageConnection?.status === "VERIFIED" &&
          video.channel.owner.creatorTerminatedAt === null
      ).length;

      return {
        status: "healthy",
        detail: `Native Library query succeeded; ${available} eligible video(s) found among the latest ${videos.length} public, ready records.`,
        issues: [],
      };
    } catch (error) {
      return {
        status: "error",
        detail: `Native Library query failed: ${error instanceof Error ? error.message : "Unknown database error"}`,
        issues: ["The Native Library data query could not complete. Review the VIDEOS_LIBRARY incident and server logs."],
      };
    }
  }


  if (component === "nextFramework" || component === "apiRuntime") {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host");
    if (!host) {
      return { status: "error", detail: "Could not determine the application host for live route checks.", issues: ["The request host header is unavailable."] };
    }
    const protocol = requestHeaders.get("x-forwarded-proto") || "http";
    const base = `${protocol}://${host}`;
    const paths = component === "nextFramework"
      ? ["/", "/api/health"]
      : ["/api/health", "/api/videos/library"];
    const probes = await Promise.all(paths.map(async (path) => {
      const started = Date.now();
      try {
        const response = await fetch(`${base}${path}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
          headers: { "x-repair-centre-probe": "1" },
        });
        return { path, status: response.status, ms: Date.now() - started, ok: response.ok };
      } catch (error) {
        return { path, status: 0, ms: Date.now() - started, ok: false,
          error: error instanceof Error ? error.message : "Request failed" };
      }
    }));
    const failed = probes.filter((probe) => !probe.ok);
    const slow = probes.filter((probe) => probe.ok && probe.ms >= 2000);
    const version = component === "nextFramework"
      ? " Framework health is assessed through live application routes; package files are not read at runtime."
      : "";
    const issues = [
      ...failed.map((p) => `${p.path}: ${p.status ? `HTTP ${p.status}` : p.error} (${p.ms} ms)`),
      ...slow.map((p) => `${p.path}: slow response (${p.ms} ms)`),
    ];
    return {
      status: failed.length ? "error" : slow.length ? "warning" : "healthy",
      detail: `${component === "nextFramework" ? "Next.js framework and application route probes" : "Live API endpoint probes"} completed.${version} ${probes.map((p) => `${p.path}: ${p.status || "unreachable"} in ${p.ms} ms`).join("; ")}`,
      issues,
      probes,
    };
  }

  if (component === "browserErrors") {
    const where = {
      source: "BROWSER_CLIENT",
      ...(role === "ADMIN" ? {} : { actorUserId: userId }),
    };
    const [count, incidents] = await Promise.all([
      prisma.platformIncident.count({ where }),
      prisma.platformIncident.findMany({
        where,
        orderBy: { lastSeenAt: "desc" },
        take: 10,
        select: { title: true, detail: true, status: true, occurrences: true, lastSeenAt: true },
      }),
    ]);
    const issues = incidents.filter((item) => item.status === "OPEN")
      .map((item) => `${item.title}: ${item.detail} (${item.occurrences} occurrence(s))`);
    return {
      status: count === 0 ? "healthy" : issues.length ? "warning" : "healthy",
      detail: count === 0
        ? "Browser error capture is active. No client exceptions or unhandled promise rejections have been recorded in this account's incident history."
        : `${count} browser incident record(s) found; showing the latest ${incidents.length}.`,
      issues,
      incidents,
    };
  }

  if (component === "nodeRuntime") {
    const memory = process.memoryUsage();
    return { status: "healthy", detail: "Node.js " + process.version + " is running on " + process.platform + "/" + process.arch + "; uptime " + Math.round(process.uptime()) + "s; RSS " + Math.round(memory.rss / 1048576) + " MB; environment " + (process.env.NODE_ENV || "unspecified") + ".", issues: [] };
  }



  if (component === "videos") {
    const where = role === "ADMIN"
      ? {}
      : { channel: { owner: { id: userId } } };
    const [total, failed, processing, repairOptions] = await Promise.all([
      prisma.video.count({ where }),
      prisma.video.count({ where: { ...where, status: "FAILED" } }),
      prisma.video.count({ where: { ...where, status: "PROCESSING" } }),
      prisma.transcodeJob.findMany({
        where: {
          status: "FAILED",
          video: role === "ADMIN"
            ? { status: "FAILED" }
            : { status: "FAILED", channel: { owner: { id: userId } } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true,
          attempts: true,
          video: { select: { title: true } },
        },
      }),
    ]);
    return {
      status: failed ? "warning" : "healthy",
      detail: `Videos: ${total}; failed: ${failed}; processing: ${processing}.`,
      issues: failed ? [`${failed} failed video record(s) need review.`] : [],
      repairOptions: repairOptions.map((job) => ({
        kind: "video",
        id: job.id,
        label: job.video.title,
        attempts: job.attempts,
      })),
    };
  }

  if (component === "podcasts") {
    const where = role === "ADMIN"
      ? {}
      : { podcast: { channel: { owner: { id: userId } } } };
    const [total, failed, uploading] = await Promise.all([
      prisma.podcastEpisode.count({ where }),
      prisma.podcastEpisode.count({ where: { ...where, status: "FAILED" } }),
      prisma.podcastEpisode.count({ where: { ...where, status: "UPLOADING" } }),
    ]);
    return {
      status: failed ? "warning" : "healthy",
      detail: `Podcast episodes: ${total}; failed: ${failed}; uploading: ${uploading}. Thumbnail processing shares the transcode worker.`,
      issues: failed ? [`${failed} failed podcast episode(s) need review.`] : [],
    };
  }

  if (component === "storage") {
    const where = role === "ADMIN" ? {} : { userId };
    const [total, errors, repairOptions] = await Promise.all([
      prisma.storageConnection.count({ where }),
      prisma.storageConnection.count({ where: { ...where, status: "ERROR" } }),
      prisma.storageConnection.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, label: true, bucketName: true, status: true },
      }),
    ]);
    return {
      status: errors ? "error" : "healthy",
      detail: `Storage connections: ${total}; connections in ERROR: ${errors}.`,
      issues: errors ? [`${errors} storage connection(s) need verification.`] : [],
      repairOptions: repairOptions.map((connection) => ({
        kind: "storage",
        id: connection.id,
        label: connection.label || connection.bucketName,
        status: connection.status,
      })),
    };
  }

  if (component === "cloudflare") {
    try {
      const response = await fetch(
        "https://web.adnansajjadnew786.workers.dev/",
        { cache: "no-store", signal: AbortSignal.timeout(10000) }
      );
      return {
        status: response.ok ? "healthy" : "error",
        detail: `Cloudflare Worker returned HTTP ${response.status}.`,
        httpStatus: response.status,
        issues: response.ok ? [] : ["The production Worker returned an unsuccessful HTTP response."],
      };
    } catch {
      return {
        status: "error",
        detail: "Cloudflare Worker could not be reached.",
        issues: ["Check Worker availability and network connectivity."],
      };
    }
  }


  if (component === "github") {
    try {
      const response = await fetch(
        "https://api.github.com/repos/AdnanSajjad786/viewers-tube",
        {
          cache: "no-store",
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": "Viewers-Tube-Repair-Centre",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        return {
          status: "error",
          detail: `GitHub repository API returned HTTP ${response.status}${response.status === 403 ? " (access may be restricted or rate-limited)" : ""}.`,
          httpStatus: response.status,
          issues: ["The repository check could not be completed from this runtime; this does not establish that the repository is unavailable."],
        };
      }

      const repo = await response.json() as {
        full_name?: string;
        private?: boolean;
        archived?: boolean;
      };

      const valid = repo.full_name === "AdnanSajjad786/viewers-tube"
        && repo.archived === false;

      return {
        status: valid ? "healthy" : "warning",
        detail: `GitHub repository ${repo.full_name ?? "unknown"} is reachable; ${repo.private ? "private" : "public"}; ${repo.archived ? "archived" : "active"}.`,
        httpStatus: response.status,
        issues: valid ? [] : ["Repository identity or archive status needs review."],
      };
    } catch {
      return {
        status: "error",
        detail: "GitHub repository API could not be reached.",
        issues: ["Check network connectivity and GitHub API availability."],
      };
    }
  }

  const names: Record<string, string> = {
    cloudflare: "Cloudflare Production",
    mediamtx: "MediaMTX / Live",
    github: "GitHub",
  };
  return {
    status: "unverified",
    detail: `${names[component] ?? component} has no configured live diagnostic in this Repair Centre. No healthy status is being assumed.`,
    issues: ["A live integration check is not configured."],
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Request origin not allowed." }, { status: 403 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true },
  });
  if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
    return NextResponse.json({ error: "Admin or Creator access required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    component?: unknown;
    action?: unknown;
  } | null;

  const allowedComponents: Component[] = [
    "database", "authentication", "website", "worker", "workerHeartbeat", "videos",
    "podcasts", "storage", "nativeLibrary", "revive", "reviveDatabase",
    "cloudflare", "mediamtx", "github", "nodeRuntime", "nextFramework", "browserErrors", "apiRuntime",
  ];
  const allowedActions: Action[] = ["diagnose", "issues", "fix", "optimize"];

  if (
    typeof body?.component !== "string" ||
    !allowedComponents.includes(body.component as Component) ||
    typeof body.action !== "string" ||
    !allowedActions.includes(body.action as Action)
  ) {
    return NextResponse.json({ error: "Invalid component or action." }, { status: 400 });
  }

  const component = body.component as Component;
  const action = body.action as Action;

  if (
    user.role !== "ADMIN" &&
    ["nodeRuntime", "nextFramework", "website", "worker", "workerHeartbeat",
     "database", "authentication", "revive", "reviveDatabase", "cloudflare",
     "mediamtx", "github"].includes(component)
  ) {
    return NextResponse.json(
      { error: "This platform-level diagnostic is restricted to administrators." },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }


  try {
    const remoteComponents: RemoteHostComponent[] = [
      "website", "worker", "revive", "reviveDatabase", "mediamtx",
    ];
    const result = user.role === "ADMIN" && remoteComponents.includes(component as RemoteHostComponent)
      ? (await inspectRemoteHost(component as RemoteHostComponent)) ?? await inspect(component, user.id, user.role)
      : await inspect(component, user.id, user.role);

    if (action === "fix") {
      if (["nextFramework", "apiRuntime", "browserErrors"].includes(component)) {
        return NextResponse.json({
          action, component, status: "assessment",
          title: "Evidence-based repair assessment",
          detail: result.status === "healthy"
            ? "No failing check currently requires repair. No changes were made."
            : "The diagnostic identified issues. Review the exact failed route or browser incident below, correct its underlying application error, then run Diagnose again. No automatic code, service or production changes were made.",
          evidence: result,
          suggestions: ("issues" in result && Array.isArray(result.issues)) ? result.issues : [],
          changed: false,
        }, { headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({
        action,
        component,
        status: "assessment",
        title: "Safe repair assessment",
        detail: result.status === "healthy"
          ? "No repair is indicated by the current checks. No changes were made."
          : component === "cloudflare"
            ? "Cloudflare cannot be repaired or verified here until a production account/API integration is configured. Configure the required Cloudflare credentials and a read-only production health check; no credentials or settings were changed."
            : component === "mediamtx"
              ? "MediaMTX cannot be repaired or verified here until its actual server endpoint and permitted health/authentication check are configured. No streaming service was restarted or changed."
              : component === "github"
                ? "GitHub cannot be repaired or verified here until a GitHub App or appropriately scoped token and repository are configured. Add a read-only repository/deployment check; no repository or deployment was changed."
                : component === "workerHeartbeat"
                  ? "No heartbeat repair was run. The heartbeat is written by the processing worker. Inspect the worker service and its logs; this action will not restart the service or fabricate a heartbeat."
                  : component === "worker"
                    ? "No automatic worker repair was run. Review the worker systemd service and its logs. A service restart requires a separate, explicit administrator action."
                    : "No automatic repair was run because no safe component-specific repair is supported by the current evidence. Review the diagnostic and use the dedicated repair controls where available.",
        evidence: result,
        repairOptions: "repairOptions" in result ? result.repairOptions : [],
        changed: false,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "optimize") {
      if (component === "nextFramework" || component === "apiRuntime" || component === "browserErrors") {
        const suggestions = component === "browserErrors"
          ? ["Group repeated errors by their source and fix the first reproducible exception.", "Avoid logging secrets or personal data in client error messages.", "Re-run the diagnostic after the browser issue is corrected."]
          : ["Compare endpoint response times across repeated checks before changing infrastructure.", "Investigate failing routes and database dependencies before tuning.", "Keep health probes lightweight and avoid exposing private diagnostic details."];
        return NextResponse.json({
          action, component, status: "analysis",
          title: "Diagnostic-based optimization",
          detail: result.detail,
          suggestions,
          evidence: result,
          changed: false,
        }, { headers: { "Cache-Control": "no-store" } });
      }
      const suggestions = result.status === "healthy"
        ? ["Continue monitoring the component; no optimization is justified by the current evidence."]
        : ["Resolve the reported issue first, then reassess performance.", "No configuration or production changes were made."];
      return NextResponse.json({
        action, component, status: "analysis",
        title: "Read-only optimization analysis",
        detail: result.detail,
        suggestions,
        changed: false,
      }, { headers: { "Cache-Control": "no-store" } });
    }

    const issues = ("issues" in result && result.issues)
      ? result.issues
      : (result.status === "healthy" ? [] : [result.detail]);
    return NextResponse.json({
      action, component, status: result.status,
      title: action === "issues" ? "Detected issues" : "Diagnostic result",
      detail: result.detail,
      issues,
      checkedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: "Component diagnostic failed.",
      detail: error instanceof Error ? error.message : "Unexpected diagnostic error.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
