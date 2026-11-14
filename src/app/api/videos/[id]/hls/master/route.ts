import { NextResponse } from "next/server";
import { getPlayableVideo } from "@/lib/video-playback-access";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const video = await getPlayableVideo(id);

    if (!video) {
      return NextResponse.json({ error: "Video is unavailable." }, { status: 404 });
    }

    if (!video.transcodeJob || video.transcodeJob.status !== "COMPLETED" || !video.renditions.length) {
      return NextResponse.json({ error: "Adaptive playback is not ready." }, { status: 404 });
    }

    const lines = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-INDEPENDENT-SEGMENTS",
    ];

    for (const rendition of video.renditions) {
      lines.push(
        `#EXT-X-STREAM-INF:BANDWIDTH=${rendition.bandwidth},RESOLUTION=${rendition.width}x${rendition.height}`,
        `/api/videos/${encodeURIComponent(id)}/hls/variant?height=${rendition.height}`
      );
    }

    return new Response(lines.join("\n") + "\n", {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("HLS master playlist failed:", error);
    return NextResponse.json({ error: "Could not prepare adaptive playback." }, { status: 500 });
  }
}
