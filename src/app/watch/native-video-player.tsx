"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type AudioGraph = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  bass: BiquadFilterNode;
  treble: BiquadFilterNode;
  panner: StereoPannerNode;
  analyser: AnalyserNode;
  gain: GainNode;
};

type ExtendedWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export function NativeVideoPlayer({ videoId }: { videoId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<AudioGraph | null>(null);
  const frameRef = useRef<number | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [url, setUrl] = useState("");
  const [hlsUrl, setHlsUrl] = useState("");
  const [qualityLevels, setQualityLevels] = useState<number[]>([]);
  const [quality, setQuality] = useState("auto");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [theater, setTheater] = useState(false);
  const [error, setError] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [bass, setBass] = useState(0);
  const [treble, setTreble] = useState(0);
  const [boost, setBoost] = useState(100);
  const [speaker, setSpeaker] = useState<"both" | "left" | "right">("both");
  const [balance, setBalance] = useState(0);
  const [visualizer, setVisualizer] = useState(true);

  useEffect(() => {
    let active = true;

    setUrl("");
    setHlsUrl("");
    setQualityLevels([]);
    setQuality("auto");
    setError("");

    fetch(`/api/videos/${encodeURIComponent(videoId)}/playback`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Playback unavailable.");
        return data;
      })
      .then((data) => {
        if (active) {
          setUrl(data.url);
          setHlsUrl(typeof data.hlsUrl === "string" ? data.hlsUrl : "");
        }
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load video.");
      });

    return () => {
      active = false;
    };
  }, [videoId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    let hls: Hls | null = null;
    let active = true;

    const useMp4Fallback = () => {
      if (!active || !video) return;
      hls?.destroy();
      hls = null;
      hlsRef.current = null;
      setQualityLevels([]);
      setQuality("auto");
      video.src = url;
      video.load();
    };

    if (hlsUrl && Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 20,
        maxMaxBufferLength: 45,
        backBufferLength: 30,
        startLevel: -1,
        capLevelToPlayerSize: true,
        abrEwmaDefaultEstimate: 350000,
      });

      hlsRef.current = hls;
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (!active) return;
        const heights = Array.from(new Set(
          data.levels.map((level) => level.height).filter((height) => height > 0)
        )).sort((a, b) => a - b);
        setQualityLevels(heights);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error("Adaptive playback failed; switching to original video.", data);
          useMp4Fallback();
        }
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
    } else if (
      hlsUrl &&
      video.canPlayType("application/vnd.apple.mpegurl")
    ) {
      video.src = hlsUrl;
      video.load();
    } else {
      video.src = url;
      video.load();
    }

    return () => {
      active = false;
      hls?.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
    };
  }, [url, hlsUrl]);

  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = quality === "auto"
      ? -1
      : hls.levels.findIndex((level) => level.height === Number(quality));
  }, [quality, qualityLevels]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  const stopVisualizer = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const startVisualizer = useCallback(() => {
    stopVisualizer();

    const canvas = canvasRef.current;
    const graph = graphRef.current;
    if (!canvas || !graph) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const data = new Uint8Array(graph.analyser.frequencyBinCount);

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      graph.analyser.getByteFrequencyData(data);
      context.clearRect(0, 0, width, height);

      const bars = 48;
      const gap = 3;
      const barWidth = (width - gap * (bars - 1)) / bars;

      for (let i = 0; i < bars; i++) {
        const value = data[Math.floor(i * data.length / bars)] || 0;
        const barHeight = Math.max(3, (value / 255) * height);

        const gradient = context.createLinearGradient(
          0, height, 0, height - barHeight
        );
        gradient.addColorStop(0, "#167eae");
        gradient.addColorStop(1, "#71f1e5");

        context.fillStyle = gradient;
        context.fillRect(
          i * (barWidth + gap),
          height - barHeight,
          barWidth,
          barHeight
        );
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    draw();
  }, [stopVisualizer]);

  const enableAudio = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      setAudioError("");

      let graph = graphRef.current;

      if (!graph) {
        const AudioContextClass =
          window.AudioContext ||
          (window as ExtendedWindow).webkitAudioContext;

        if (!AudioContextClass) {
          throw new Error("Web Audio is not supported by this browser.");
        }

        const context = new AudioContextClass();
        const source = context.createMediaElementSource(video);

        const bassFilter = context.createBiquadFilter();
        bassFilter.type = "lowshelf";
        bassFilter.frequency.value = 120;

        const trebleFilter = context.createBiquadFilter();
        trebleFilter.type = "highshelf";
        trebleFilter.frequency.value = 4000;

        const panner = context.createStereoPanner();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        const gain = context.createGain();
        gain.gain.value = 1;

        source.connect(bassFilter);
        bassFilter.connect(trebleFilter);
        trebleFilter.connect(panner);
        panner.connect(analyser);
        analyser.connect(gain);
        gain.connect(context.destination);

        graph = {
          context,
          source,
          bass: bassFilter,
          treble: trebleFilter,
          panner,
          analyser,
          gain,
        };

        graphRef.current = graph;
      }

      await graph.context.resume();
      setAudioEnabled(true);
      startVisualizer();
    } catch (err) {
      setAudioError(
        err instanceof Error ? err.message : "Audio effects could not start."
      );
      setAudioEnabled(false);
    }
  };

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    if (!audioEnabled) {
      graph.bass.gain.value = 0;
      graph.treble.gain.value = 0;
      graph.gain.gain.value = 1;
      graph.panner.pan.value = 0;
      return;
    }

    graph.bass.gain.value = bass;
    graph.treble.gain.value = treble;
    graph.gain.gain.value = boost / 100;
    graph.panner.pan.value =
      speaker === "left" ? -1 :
      speaker === "right" ? 1 : balance;
  }, [audioEnabled, bass, treble, boost, speaker, balance]);

  useEffect(() => {
    if (audioEnabled && visualizer) startVisualizer();
    else stopVisualizer();

    return stopVisualizer;
  }, [audioEnabled, visualizer, startVisualizer, stopVisualizer]);

  useEffect(() => {
    return () => {
      stopVisualizer();
      const graph = graphRef.current;
      graphRef.current = null;
      if (graph) void graph.context.close();
    };
  }, [stopVisualizer]);

  if (error) {
    return <p style={{ color: "#ffb5b5", marginTop: 20 }}>{error}</p>;
  }

  if (!url) {
    return <p style={{ color: "#aab2c5", marginTop: 20 }}>
      Preparing secure playback...
    </p>;
  }

  const panel: React.CSSProperties = {
    background: "#101827",
    color: "#f2f7ff",
    border: "1px solid #293c55",
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
  };

  const button: React.CSSProperties = {
    background: "#1b2b40",
    color: "#eafaff",
    border: "1px solid #425b77",
    borderRadius: 9,
    padding: "9px 13px",
    cursor: "pointer",
  };

  return (
    <div>
      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        style={{
          display: "block",
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#000",
          borderRadius: 14,
          maxHeight: theater ? "none" : undefined,
        }}
      >
        Your browser does not support HTML video playback.
      </video>

      <section style={{ ...panel, marginTop: 10 }}>
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span>Quality</span>
            <select
              value={quality}
              onChange={(event) => setQuality(event.target.value)}
              style={{ ...button, padding: "8px 10px" }}
            >
              <option value="auto">Auto</option>
              {qualityLevels.map((height) => (
                <option key={height} value={String(height)}>{height}p</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span>Speed</span>
            <select
              value={playbackRate}
              onChange={(event) => setPlaybackRate(Number(event.target.value))}
              style={{ ...button, padding: "8px 10px" }}
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                <option key={rate} value={rate}>
                  {rate === 1 ? "Normal" : `${rate}×`}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            style={button}
            onClick={() => setTheater((value) => !value)}
            aria-pressed={theater}
          >
            {theater ? "Exit theater" : "Theater mode"}
          </button>

          <button
            type="button"
            style={button}
            onClick={() => {
              const video = videoRef.current;
              if (video?.requestPictureInPicture) {
                void video.requestPictureInPicture().catch((err) =>
                  console.error("Picture-in-Picture unavailable:", err)
                );
              }
            }}
          >
            Picture-in-Picture
          </button>

          <button
            type="button"
            style={button}
            onClick={() => {
              const video = videoRef.current;
              if (video?.requestFullscreen) {
                void video.requestFullscreen().catch((err) =>
                  console.error("Fullscreen unavailable:", err)
                );
              }
            }}
          >
            Fullscreen
          </button>

          <span style={{ color: "#9eb2ca", fontSize: 12 }}>
            {hlsUrl ? "Adaptive stream available" : "Original video stream"}
          </span>
        </div>
      </section>

      <section style={panel}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}>
          <div>
            <strong style={{ fontSize: 17 }}>Audio Studio</strong>
            <div style={{ color: "#9eb2ca", fontSize: 12, marginTop: 4 }}>
              Equalizer · Stereo · Bass · Treble · Volume boost
            </div>
          </div>

          <button
            type="button"
            style={button}
            onClick={audioEnabled ? () => {
              setAudioEnabled(false);
              stopVisualizer();
            } : enableAudio}
          >
            {audioEnabled ? "Turn effects off" : "Enable audio effects"}
          </button>
        </div>

        {audioError && (
          <p role="status" style={{ color: "#ffb5b5", fontSize: 13 }}>
            {audioError}
          </p>
        )}

        {audioEnabled && (
          <>
            <div style={{
              marginTop: 18,
              padding: 12,
              borderRadius: 10,
              background: "#080f1b",
            }}>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                color: "#78e9ed",
                fontSize: 11,
                letterSpacing: 1,
                marginBottom: 8,
              }}>
                <strong>LIVE AUDIO EQUALIZER</strong>
                <span>{visualizer ? "ACTIVE" : "OFF"}</span>
              </div>

              <canvas
                ref={canvasRef}
                width={720}
                height={100}
                style={{
                  display: visualizer ? "block" : "none",
                  width: "100%",
                  height: 90,
                }}
              />

              <button
                type="button"
                style={button}
                onClick={() => setVisualizer((value) => !value)}
              >
                {visualizer ? "Hide visualizer" : "Show visualizer"}
              </button>
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
              gap: 18,
              marginTop: 20,
            }}>
              <label>
                <strong>Bass</strong>
                <span style={{ float: "right", color: "#79e5e9" }}>
                  {bass > 0 ? "+" : ""}{bass} dB
                </span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={bass}
                  onChange={(event) => setBass(Number(event.target.value))}
                  style={{ display: "block", width: "100%", marginTop: 12 }}
                />
              </label>

              <label>
                <strong>Treble</strong>
                <span style={{ float: "right", color: "#79e5e9" }}>
                  {treble > 0 ? "+" : ""}{treble} dB
                </span>
                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="1"
                  value={treble}
                  onChange={(event) => setTreble(Number(event.target.value))}
                  style={{ display: "block", width: "100%", marginTop: 12 }}
                />
              </label>

              <label>
                <strong>Volume boost</strong>
                <span style={{ float: "right", color: "#79e5e9" }}>
                  {boost}%
                </span>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="5"
                  value={boost}
                  onChange={(event) => setBoost(Number(event.target.value))}
                  style={{ display: "block", width: "100%", marginTop: 12 }}
                />
                <small style={{ color: "#aab2c5" }}>
                  High boost may cause distortion.
                </small>
              </label>
            </div>

            <div style={{ marginTop: 22 }}>
              <strong>Stereo speaker output</strong>
              <div style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 9,
                marginTop: 10,
              }}>
                {(["left", "right", "both"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={speaker === mode}
                    style={{
                      ...button,
                      background: speaker === mode ? "#12616b" : "#1b2b40",
                      borderColor: speaker === mode ? "#70e5ed" : "#425b77",
                    }}
                    onClick={() => setSpeaker(mode)}
                  >
                    {mode === "left" ? "◀ Left speaker" :
                     mode === "right" ? "Right speaker ▶" :
                     "◀ Both speakers ▶"}
                  </button>
                ))}
              </div>
            </div>

            {speaker === "both" && (
              <label style={{ display: "block", marginTop: 18 }}>
                <strong>Stereo balance</strong>
                <span style={{ float: "right", color: "#79e5e9" }}>
                  {balance === 0 ? "Center" : balance < 0 ? "Left" : "Right"}
                </span>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={balance}
                  onChange={(event) => setBalance(Number(event.target.value))}
                  style={{ display: "block", width: "100%", marginTop: 12 }}
                />
              </label>
            )}

            <button
              type="button"
              style={{ ...button, marginTop: 20 }}
              onClick={() => {
                setBass(0);
                setTreble(0);
                setBoost(100);
                setSpeaker("both");
                setBalance(0);
              }}
            >
              Reset audio settings
            </button>
          </>
        )}

        {!audioEnabled && (
          <p style={{ color: "#aab2c5", fontSize: 13, marginTop: 15 }}>
            Standard playback is unchanged. Enable Audio Studio to use the
            equalizer and stereo effects.
          </p>
        )}
      </section>
    </div>
  );
}
