import { loadEnvConfig } from "@next/env";

async function start() {
  loadEnvConfig(process.cwd());
  await import("./transcode-worker");
}

start().catch((error) => {
  console.error("Worker startup failed:", error);
  process.exitCode = 1;
});
