import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHmac, timingSafeEqual } from "node:crypto";

const run = promisify(execFile);
const token = process.env.LOCAL_DIAGNOSTICS_TOKEN;
const port = 8091;

if (!token || token.length < 32) {
  console.error("LOCAL_DIAGNOSTICS_TOKEN must contain at least 32 characters.");
  process.exit(1);
}

async function service(name) {
  const { stdout } = await run("systemctl", [
    "show", name, "--property=ActiveState",
    "--property=SubState", "--no-pager"
  ], { timeout: 5000 });
  const values = Object.fromEntries(
    stdout.trim().split("\n").map(line => line.split("="))
  );
  const active = values.ActiveState === "active";
  return {
    status: active ? "healthy" :
      values.ActiveState === "inactive" ? "error" : "warning",
    detail: `${name}: ${values.ActiveState} (${values.SubState})`,
    observable: true
  };
}

async function container(name) {
  const { stdout } = await run("docker", [
    "inspect", name, "--format",
    "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}"
  ], { timeout: 5000 });
  const value = stdout.trim();
  const running = value.startsWith("running");
  const healthy = value.includes(" healthy");
  return {
    status: !running ? "error" : healthy ? "healthy" : "warning",
    detail: `${name}: ${value}`,
    observable: true
  };
}

async function inspect(component) {
  if (component === "workerHeartbeat")
    return service("viewers-tube-worker.service");

  if (component === "nextFramework" || component === "apiRuntime")
    return service("viewers-tube-web.service");

  if (component === "website")
    return service("viewers-tube-web.service");

  if (component === "worker")
    return service("viewers-tube-worker.service");

  if (component === "revive") {
    const state = await service("revive-adserver.service");
    const response = await fetch("http://127.0.0.1:8090/", {
      signal: AbortSignal.timeout(4000),
      redirect: "follow"
    });
    return {
      status: state.status === "healthy" && response.ok ? "healthy" : "error",
      detail: `Revive HTTP ${response.status}. ${state.detail}`,
      issues: response.ok ? [] : ["Revive HTTP check failed."]
    };
  }

  if (component === "reviveDatabase")
    return container("revive-local-db");

  if (component === "mediamtx") {
    const state = await container("viewers-tube-mediamtx");
    const response = await fetch("http://127.0.0.1:9997/v3/paths/list", {
      signal: AbortSignal.timeout(4000)
    });
    const data = await response.json();
    const valid = Array.isArray(data.items);
    const healthy = state.status === "healthy" && response.ok && valid;
    return {
      status: healthy ? "healthy" : "error",
      detail: `MediaMTX: ${state.detail}; API HTTP ${response.status}; ${valid ? data.items.length : 0} paths.`,
      issues: healthy ? [] : ["Check MediaMTX container and API."]
    };
  }

  throw new Error("Diagnostic component not allowed.");
}


const repairTargets = {
  workerHeartbeat: { type: "service", name: "viewers-tube-worker.service" },
  nextFramework: { type: "service", name: "viewers-tube-web.service" },
  apiRuntime: { type: "service", name: "viewers-tube-web.service" },
  website: { type: "service", name: "viewers-tube-web.service" },
  worker: { type: "service", name: "viewers-tube-worker.service" },
  revive: { type: "service", name: "revive-adserver.service" },
  reviveDatabase: { type: "container", name: "revive-local-db" },
  mediamtx: { type: "container", name: "viewers-tube-mediamtx" }
};

async function repair(component) {
  const target = repairTargets[component];
  if (!target) throw new Error("Repair target is not allowlisted.");

  if (target.type === "service") {
    await run("systemctl", ["restart", target.name], { timeout: 20000 });
  } else {
    await run("docker", ["restart", "--time", "10", target.name], {
      timeout: 25000
    });
  }

  await new Promise(resolve => setTimeout(resolve, 2500));
  const verification = await inspect(component);

  return {
    ...verification,
    repaired: verification.status === "healthy",
    detail: `Restart requested for ${target.name}. ${verification.detail}`
  };
}


// Local automatic recovery watchdog.
// Database failures are reported separately; they do not trigger blind restarts.
let websiteFailures = 0;
let lastWebsiteRestart = 0;
let lastDatabaseNotice = 0;
let monitoring = false;

async function monitorLocalPlatform() {
  if (monitoring) return;
  monitoring = true;

  try {
    let websiteOk = false;
    try {
      const response = await fetch("http://127.0.0.1:3001/login", {
        signal: AbortSignal.timeout(8000),
        redirect: "follow"
      });
      websiteOk = response.ok;
    } catch {}

    if (websiteOk) {
      websiteFailures = 0;
    } else {
      websiteFailures++;
      console.error(`[auto-repair] Website health failure ${websiteFailures}/3`);

      if (websiteFailures >= 3 && Date.now() - lastWebsiteRestart >= 600000) {
        lastWebsiteRestart = Date.now();
        websiteFailures = 0;
        console.error("[auto-repair] Attempting allowlisted website service recovery.");

        try {
          const result = await repair("website");
          const response = await fetch("http://127.0.0.1:3001/login", {
            signal: AbortSignal.timeout(10000),
            redirect: "follow"
          });
          console.log(`[auto-repair] Website recovery: ${result.status}; HTTP ${response.status}`);
        } catch (error) {
          console.error("[auto-repair] Website recovery failed:", error);
        }
      }
    }

    try {
      const response = await fetch("http://127.0.0.1:3001/api/health", {
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok && Date.now() - lastDatabaseNotice >= 300000) {
        lastDatabaseNotice = Date.now();
        console.error(`[auto-repair] Database health alert: HTTP ${response.status}. No blind restart performed.`);
      }
    } catch (error) {
      if (Date.now() - lastDatabaseNotice >= 300000) {
        lastDatabaseNotice = Date.now();
        console.error("[auto-repair] Database health check unreachable:", error);
      }
    }
  } finally {
    monitoring = false;
  }
}

setTimeout(() => {
  monitorLocalPlatform().catch(error =>
    console.error("[auto-repair] Watchdog error:", error)
  );
  setInterval(() => {
    monitorLocalPlatform().catch(error =>
      console.error("[auto-repair] Watchdog error:", error)
    );
  }, 30000);
}, 15000);

const server = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  const origin = req.headers.origin;
  const allowedOrigins = new Set([
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:8787",
    "http://127.0.0.1:8787"
  ]);

  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Vary", "Origin");
  }

  if (req.method === "OPTIONS") {
    if (!origin || !allowedOrigins.has(origin)) {
      res.writeHead(403).end(JSON.stringify({ error: "Local origin required." }));
      return;
    }
    res.writeHead(204).end();
    return;
  }

  if (req.method !== "POST" || !["/diagnose", "/repair"].includes(req.url)) {
    res.writeHead(404).end(JSON.stringify({ error: "Not found" }));
    return;
  }

  const match = /^Bearer (\d{13})\.([a-f0-9]{64})$/.exec(
    req.headers.authorization || ""
  );
  if (!origin || !allowedOrigins.has(origin) || !match) {
    res.writeHead(401).end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const expires = Number(match[1]);
  const supplied = Buffer.from(match[2], "hex");
  const expected = createHmac("sha256", token)
    .update(`${match[1]}.${origin}`)
    .digest();

  if (
    expires <= Date.now() ||
    expires > Date.now() + 35_000 ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    res.writeHead(401).end(JSON.stringify({ error: "Invalid or expired token." }));
    return;
  }

  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 2048) {
      res.writeHead(413).end(JSON.stringify({ error: "Request too large" }));
      return;
    }
  }

  try {
    const payload = JSON.parse(body);
    if (req.url === "/repair") {
      if (payload.confirm !== "RESTART_LOCAL_COMPONENT") {
        res.writeHead(400).end(JSON.stringify({ error: "Explicit repair confirmation required." }));
        return;
      }
      const result = await repair(payload.component);
      res.writeHead(200).end(JSON.stringify(result));
      return;
    }
    const result = await inspect(payload.component);
    res.writeHead(200).end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(200).end(JSON.stringify({
      status: "error",
      detail: error instanceof Error ? error.message : "Host diagnostic failed.",
      issues: ["Review host service and container logs."]
    }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Local diagnostics listening on 127.0.0.1:${port}`);
});
