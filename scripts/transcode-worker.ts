import {
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createB2Client } from "../src/lib/b2-client";
import { prisma } from "./worker-prisma";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import type { Readable } from "node:stream";

const execFileAsync = promisify(execFile);
const POLL_MS = 3000;
const HEIGHTS = [144, 240, 360, 480, 720, 1080];

type ProbeResult = {
  streams?: Array<{
    codec_type?: string;
    width?: number;
    height?: number;
  }>;
};

function runFfmpeg(args: string): Promise<void>;
function runFfmpeg(args: string[]): Promise<void>;
function runFfmpeg(args: string[] | string): Promise<void> {
  const actualArgs = typeof args === "string" ? [args] : args;

  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", actualArgs, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-12000);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

async function probeVideo(file: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_streams",
    "-of", "json",
    file,
  ]);

  const result = JSON.parse(stdout) as ProbeResult;
  const stream = result.streams?.find(
    (item) => item.codec_type === "video" && item.width && item.height
  );

  if (!stream?.width || !stream.height) {
    throw new Error("The uploaded file has no readable video stream.");
  }

  return { width: stream.width, height: stream.height };
}

async function processJob(jobId: string) {
  const job = await prisma.transcodeJob.findUnique({
    where: { id: jobId },
    include: {
      video: {
        include: { storageConnection: true },
      },
    },
  });

  if (
    !job ||
    job.status !== "RUNNING" ||
    job.video.status !== "PROCESSING" ||
    !job.video.storageConnection ||
    !job.video.storageKey
  ) {
    throw new Error("Video, job, or verified storage connection is unavailable.");
  }

  const video = job.video;
  const connection = video.storageConnection;
  const storageKey = video.storageKey;

  if (!connection || !storageKey) {
    throw new Error("Video storage connection or source key is missing.");
  }

  const client = createB2Client(connection);
  const workDir = await mkdtemp(join(tmpdir(), "viewerstube-transcode-"));

  try {
    console.log(`[${video.id}] Downloading source video`);

    const sourcePath = join(workDir, "source");
    const source = await client.send(new GetObjectCommand({
      Bucket: connection.bucketName,
      Key: storageKey,
    }));

    if (!source.Body) throw new Error("B2 returned an empty video object.");

    await pipeline(
      source.Body as Readable,
      createWriteStream(sourcePath)
    );

    const dimensions = await probeVideo(sourcePath);

    // Capture a preview frame from the source video.
    const thumbnailPath = join(workDir, "thumbnail.jpg");
    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", "1", "-i", sourcePath,
      "-frames:v", "1",
      "-vf", "scale=640:-2",
      "-q:v", "3",
      thumbnailPath,
    ]);

    const thumbnailKey = `${storageKey}.hls/thumbnail.jpg`;
    const thumbnailStat = await stat(thumbnailPath);

    await client.send(new PutObjectCommand({
      Bucket: connection.bucketName,
      Key: thumbnailKey,
      Body: createReadStream(thumbnailPath),
      ContentLength: thumbnailStat.size,
      ContentType: "image/jpeg",
    }));

    await prisma.video.update({
      where: { id: video.id },
      data: { thumbnailUrl: `/api/videos/${encodeURIComponent(video.id)}/thumbnail` },
    });

    const sourceHeight = dimensions.height;
    const selectedHeights = HEIGHTS.filter((height) => height <= sourceHeight);

    if (selectedHeights.length === 0) {
      selectedHeights.push(Math.max(2, Math.floor(sourceHeight / 2) * 2));
    }

    const completed: Array<{
      height: number;
      width: number;
      bandwidth: number;
      playlistKey: string;
    }> = [];

    for (const height of selectedHeights) {
      const outputDir = join(workDir, String(height));
      const playlistPath = join(outputDir, "index.m3u8");
      const segmentPattern = join(outputDir, "segment_%05d.ts");

      const width = Math.max(
        2,
        Math.floor((dimensions.width * height / sourceHeight) / 2) * 2
      );

      await import("node:fs/promises").then(({ mkdir }) =>
        mkdir(outputDir, { recursive: true })
      );

      console.log(`[${video.id}] Encoding ${height}p`);

      const maxRate = Math.max(250, Math.round(height * 3.5));
      await runFfmpeg([
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", sourcePath,
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-vf", `scale=-2:${height}:flags=lanczos,setsar=1`,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-threads", "1",
        "-pix_fmt", "yuv420p",
        "-profile:v", "main",
        "-crf", "23",
        "-maxrate", `${maxRate}k`,
        "-bufsize", `${maxRate * 2}k`,
        "-c:a", "aac",
        "-b:a", "128k",
        "-ac", "2",
        "-ar", "48000",
        "-f", "hls",
        "-hls_time", "6",
        "-hls_playlist_type", "vod",
        "-hls_segment_filename", segmentPattern,
        playlistPath,
      ]);

      const playlistKey = `${storageKey}.hls/${height}/index.m3u8`;
      const files = await readdir(outputDir);

      for (const name of files) {
        const path = join(outputDir, name);
        const fileStat = await stat(path);
        const isPlaylist = name.endsWith(".m3u8");

        await client.send(new PutObjectCommand({
          Bucket: connection.bucketName,
          Key: `${storageKey}.hls/${height}/${name}`,
          Body: createReadStream(path),
          ContentLength: fileStat.size,
          ContentType: isPlaylist
            ? "application/vnd.apple.mpegurl"
            : "video/mp2t",
        }));
      }

      completed.push({
        height,
        width,
        bandwidth: (maxRate + 128) * 1000,
        playlistKey,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.videoRendition.deleteMany({
        where: { videoId: video.id },
      });

      await tx.videoRendition.createMany({
        data: completed.map((item) => ({
          videoId: video.id,
          ...item,
        })),
      });

      await tx.transcodeJob.update({
        where: { id: job.id },
        data: { status: "COMPLETED", error: null },
      });
      await tx.video.update({
        where: { id: video.id },
        data: { status: "READY" },
      });
    });

    console.log(
      `[${video.id}] Completed: ${completed.map((item) => `${item.height}p`).join(", ")}`
    );
  } finally {
    client.destroy();
    await rm(workDir, { recursive: true, force: true });
  }
}

async function processNextJob(): Promise<boolean> {
  const candidate = await prisma.transcodeJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!candidate) return false;

  const claimed = await prisma.transcodeJob.updateMany({
    where: { id: candidate.id, status: "PENDING" },
    data: {
      status: "RUNNING",
      attempts: { increment: 1 },
      error: null,
    },
  });

  if (claimed.count !== 1) return true;

  try {
    await processJob(candidate.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown transcoding error";
    console.error(`[${candidate.id}] Transcoding failed:`, message);

    await prisma.transcodeJob.update({
      where: { id: candidate.id },
      data: {
        status: "FAILED",
        error: message.slice(0, 4000),
      },
    }).catch((dbError) => {
      console.error("Could not update failed job:", dbError);
    });
    await prisma.video.update({
      where: { id: (await prisma.transcodeJob.findUniqueOrThrow({
        where: { id: candidate.id },
        select: { videoId: true },
      })).videoId },
      data: { status: "FAILED" },
    }).catch((dbError) => {
      console.error("Could not mark video as failed:", dbError);
    });
  }

  return true;
}


// Podcast video thumbnails are processed separately from Video transcoding.
const failedPodcastThumbnailIds = new Set<string>();

async function processNextPodcastThumbnail(): Promise<boolean> {
  const candidates = await prisma.podcastEpisode.findMany({
    where: {
      status: { in: ["READY", "PUBLISHED"] },
      contentType: { startsWith: "video/" },
      thumbnailUrl: null,
      storageConnection: { status: "VERIFIED" },
    },
    orderBy: { createdAt: "asc" },
    take: 20,
    include: { storageConnection: true },
  });

  const episode = candidates.find(
    (item) => !failedPodcastThumbnailIds.has(item.id)
  );

  if (!episode) return false;

  let client: ReturnType<typeof createB2Client> | undefined;
  let workDir: string | undefined;

  try {
    const connection = episode.storageConnection;
    client = createB2Client(connection);
    workDir = await mkdtemp(join(tmpdir(), "viewerstube-podcast-"));

    console.log(`[Podcast ${episode.id}] Downloading source for thumbnail`);

    const sourcePath = join(workDir, "source");
    const source = await client.send(new GetObjectCommand({
      Bucket: connection.bucketName,
      Key: episode.storageKey,
    }));

    if (!source.Body) throw new Error("B2 returned an empty podcast video.");

    await pipeline(
      source.Body as Readable,
      createWriteStream(sourcePath)
    );

    const thumbnailPath = join(workDir, "thumbnail.jpg");

    await runFfmpeg([
      "-hide_banner", "-loglevel", "error", "-y",
      "-ss", "1", "-i", sourcePath,
      "-frames:v", "1",
      "-vf", "scale=640:-2",
      "-q:v", "3",
      thumbnailPath,
    ]);

    const thumbnailKey = `${episode.storageKey}.hls/thumbnail.jpg`;
    const thumbnailStat = await stat(thumbnailPath);

    await client.send(new PutObjectCommand({
      Bucket: connection.bucketName,
      Key: thumbnailKey,
      Body: createReadStream(thumbnailPath),
      ContentLength: thumbnailStat.size,
      ContentType: "image/jpeg",
    }));

    await prisma.podcastEpisode.update({
      where: { id: episode.id },
      data: {
        thumbnailUrl: `/api/podcasts/episodes/${encodeURIComponent(episode.id)}/thumbnail`,
      },
    });

    console.log(`[Podcast ${episode.id}] Thumbnail generated.`);
  } catch (error) {
    failedPodcastThumbnailIds.add(episode.id);
    console.error(`[Podcast ${episode.id}] Thumbnail generation failed:`, error);
  } finally {
    client?.destroy();
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }

  return true;
}

async function publishDueVideos() {
  const now = new Date();
  const due = await prisma.video.findMany({
    where: {
      status: "READY",
      scheduledAt: { lte: now },
      scheduledVisibility: { not: null },
    },
    select: { id: true, scheduledVisibility: true },
    take: 50,
  });

  for (const video of due) {
    if (!video.scheduledVisibility) continue;
    await prisma.video.updateMany({
      where: {
        id: video.id,
        status: "READY",
        scheduledAt: { lte: now },
        scheduledVisibility: video.scheduledVisibility,
      },
      data: {
        visibility: video.scheduledVisibility,
        scheduledAt: null,
        scheduledVisibility: null,
      },
    });
    console.log(`[${video.id}] Scheduled publication checked.`);
  }
}

async function main() {
  console.log("Viewers Tube transcoding worker started (single-job mode).");

  let stopping = false;
  process.once("SIGINT", () => { stopping = true; });
  process.once("SIGTERM", () => { stopping = true; });

  const writeHeartbeat = async () => {
    try {
      const now = new Date();
      await prisma.workerHeartbeat.upsert({
        where: { id: "transcode-worker" },
        create: { id: "transcode-worker", lastSeenAt: now },
        update: { lastSeenAt: now },
      });
    } catch {
      console.error("[worker] Heartbeat update failed.");
    }
  };

  // Recover abandoned jobs periodically, including after worker restarts.
  let lastStaleJobRecoveryAt = 0;
  const recoverAbandonedJobs = async () => {
    lastStaleJobRecoveryAt = Date.now();
    try {
      const staleBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recovered = await prisma.transcodeJob.updateMany({
        where: {
          status: "RUNNING",
          updatedAt: { lt: staleBefore },
          video: { is: { status: "PROCESSING" } },
        },
        data: {
          status: "PENDING",
          error: "Automatically requeued after worker interruption.",
        },
      });
      if (recovered.count > 0) {
        console.warn(`[worker] Requeued ${recovered.count} abandoned job(s).`);
      }
    } catch (error) {
      console.error("[worker] Abandoned-job recovery failed:", error);
    }
  };

  await recoverAbandonedJobs();
  await writeHeartbeat();
  const heartbeatTimer = setInterval(() => {
    void writeHeartbeat();
  }, 15_000);

  let consecutiveLoopErrors = 0;

  try {
    while (!stopping) {
      try {
        if (Date.now() - lastStaleJobRecoveryAt >= 5 * 60 * 1000) {
          await recoverAbandonedJobs();
        }

        await publishDueVideos();
        const foundVideoJob = await processNextJob();
        const foundPodcastThumbnail = foundVideoJob
          ? false
          : await processNextPodcastThumbnail();

        consecutiveLoopErrors = 0;

        if (!foundVideoJob && !foundPodcastThumbnail && !stopping) {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        }
      } catch (error) {
        consecutiveLoopErrors += 1;
        const delay = Math.min(
          120_000,
          POLL_MS * 2 ** Math.min(consecutiveLoopErrors, 6)
        );

        console.error(
          `[worker] Main loop failed (attempt ${consecutiveLoopErrors}). ` +
          `Retrying in ${Math.round(delay / 1000)} seconds:`,
          error
        );

        if (!stopping) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
  } finally {
    clearInterval(heartbeatTimer);
    await prisma.$disconnect();
    console.log("Transcoding worker stopped.");
  }
}

main().catch(async (error) => {
  console.error("Worker stopped unexpectedly:", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
