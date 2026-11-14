import { spawn } from "node:child_process";

const mode = process.argv[2];
if (mode !== "dev" && mode !== "start") {
  throw new Error("Use dev or start.");
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const appArgs = ["run", mode, "--", ...process.argv.slice(3)];

const app = spawn(npm, appArgs, { stdio: "inherit", env: process.env });
const worker = spawn(npm, ["run", "worker:transcode"], {
  stdio: "inherit",
  env: process.env,
});

let stopping = false;
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  app.kill("SIGTERM");
  worker.kill("SIGTERM");
  process.exitCode = code;
}
app.once("error", () => stop(1));
worker.once("error", () => stop(1));
app.once("exit", (code) => stop(code ?? 1));
worker.once("exit", (code) => {
  if (!stopping) {
    console.error("Transcoding worker exited unexpectedly:", code);
    stop(code ?? 1);
  }
});
process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));
