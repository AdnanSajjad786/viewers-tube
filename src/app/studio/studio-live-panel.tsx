"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type LiveStream = {
  id: string;
  title: string;
  description: string | null;
  streamPath: string;
  visibility: "PUBLIC" | "PRIVATE";
  enabled: boolean;
  isLive: boolean;
  createdAt: string;
  endedAt: string | null;
  playbackUrl: string;
};

type CreatedStream = {
  publishUrl: string;
  playbackUrl: string;
  warning: string;
};

export function StudioLivePanel() {
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [created, setCreated] = useState<CreatedStream | null>(null);
  const [busy, setBusy] = useState(false);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevice, setVideoDevice] = useState("");
  const [audioDevice, setAudioDevice] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const previewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRef = useRef<MediaStream | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/studio/live", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load live sessions.");
      setStreams(data.streams || []);
      setError(data.message || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load live sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startLocalRecording(streamTitle: string) {
    if (!mediaRef.current) throw new Error("Camera and microphone are unavailable.");
    if (typeof MediaRecorder === "undefined") {
      throw new Error("This browser does not support local recording.");
    }

    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find((type) => MediaRecorder.isTypeSupported(type));

    const recorder = new MediaRecorder(
      mediaRef.current,
      mimeType ? { mimeType } : undefined
    );

    recordingChunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) recordingChunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      const chunks = recordingChunksRef.current;
      recordingChunksRef.current = [];
      recorderRef.current = null;
      setRecording(false);

      if (!chunks.length) return;

      const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeTitle = streamTitle.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "") || "live-session";
      link.href = url;
      link.download = `${safeTitle}-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    };

    recorderRef.current = recorder;
    recorder.start(1000);
    setRecording(true);
  }

  function finishLocalRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve();

    return new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });
  }

  const stopLocalMedia = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }
    if (mediaRef.current) {
      mediaRef.current.getTracks().forEach((track) => track.stop());
      mediaRef.current = null;
    }
    if (previewRef.current) previewRef.current.srcObject = null;
    setPreviewing(false);
    setPublishingId(null);
  }, []);

  useEffect(() => {
    return () => {
      peerRef.current?.close();
      mediaRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function startPreview() {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access is unavailable. Use localhost or a secure HTTPS connection.");
      }

      stopLocalMedia();

      const media = await navigator.mediaDevices.getUserMedia({
        video: videoDevice ? { deviceId: { exact: videoDevice } } : true,
        audio: {
          ...(audioDevice ? { deviceId: { exact: audioDevice } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });

      mediaRef.current = media;
      if (previewRef.current) previewRef.current.srcObject = media;

      const available = await navigator.mediaDevices.enumerateDevices();
      setDevices(available.filter((device) =>
        device.kind === "videoinput" || device.kind === "audioinput"
      ));
      setPreviewing(true);
    } catch (err) {
      stopLocalMedia();
      setError(err instanceof Error ? err.message : "Could not access camera or microphone.");
    }
  }

  async function startBrowserLive(stream: LiveStream) {
    setBusy(true);
    setError("");

    let peer: RTCPeerConnection | null = null;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera access requires localhost or HTTPS.");
      }

      if (!mediaRef.current) {
        const media = await navigator.mediaDevices.getUserMedia({
          video: videoDevice ? { deviceId: { exact: videoDevice } } : true,
          audio: {
          ...(audioDevice ? { deviceId: { exact: audioDevice } } : {}),
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        });
        mediaRef.current = media;
        if (previewRef.current) previewRef.current.srcObject = media;
        setPreviewing(true);

        const available = await navigator.mediaDevices.enumerateDevices();
        setDevices(available.filter((device) =>
          device.kind === "videoinput" || device.kind === "audioinput"
        ));
      }

      const credentialResponse = await fetch(
        `/api/studio/live/${encodeURIComponent(stream.id)}/browser-credentials`,
        { method: "POST", cache: "no-store" },
      );
      const credentials = await credentialResponse.json();

      if (!credentialResponse.ok) {
        throw new Error(credentials.error || "Could not prepare browser publishing.");
      }

      peer = new RTCPeerConnection();
      peerRef.current = peer;

      mediaRef.current!.getTracks().forEach((track) => {
        peer!.addTrack(track, mediaRef.current!);
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      // Wait for ICE gathering so the SDP can be sent in one WHIP request.
      if (peer.iceGatheringState !== "complete") {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => {
            reject(new Error("Network connection setup timed out. Please try again."));
          }, 15000);

          const checkIce = () => {
            if (peer!.iceGatheringState === "complete") {
              window.clearTimeout(timeout);
              peer!.removeEventListener("icegatheringstatechange", checkIce);
              resolve();
            }
          };

          peer!.addEventListener("icegatheringstatechange", checkIce);
        });
      }

      const whipUrl = `http://localhost:8889${credentials.whipPath}`;
      const authorization = btoa(`${credentials.username}:${credentials.password}`);

      const response = await fetch(whipUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/sdp",
          Accept: "application/sdp",
        },
        body: peer.localDescription?.sdp,
      });

      if (!response.ok) {
        throw new Error(`Media server rejected browser publishing (HTTP ${response.status}).`);
      }

      const answer = await response.text();

      await peer.setRemoteDescription({
        type: "answer",
        sdp: answer,
      });

      setPublishingId(stream.id);
      try {
        startLocalRecording(stream.title);
        setError("");
      } catch (recordingError) {
        setError(recordingError instanceof Error ? recordingError.message : "Local recording could not start.");
      }
      await load();
    } catch (err) {
      peer?.close();
      if (peerRef.current === peer) peerRef.current = null;
      setError(err instanceof Error ? err.message : "Could not start browser live video.");
    } finally {
      setBusy(false);
    }
  }

  async function createStream(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCreated(null);

    try {
      const response = await fetch("/api/studio/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not create stream.");

      setCreated({
        publishUrl: data.publishUrl,
        playbackUrl: data.playbackUrl,
        warning: data.warning,
      });
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create stream.");
    } finally {
      setBusy(false);
    }
  }

  async function stopStream(stream: LiveStream) {
    if (!window.confirm(`Stop and disable "${stream.title}"? This revokes its publishing credentials.`)) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/studio/live/${encodeURIComponent(stream.id)}`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not stop stream.");

      if (publishingId === stream.id) {
        await finishLocalRecording();
        stopLocalMedia();
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop stream.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteStream(stream: LiveStream) {
    if (stream.enabled || stream.isLive) {
      setError("Stop this broadcast before deleting it.");
      return;
    }

    if (!window.confirm(
      `Permanently delete "${stream.title}"? This removes its broadcast entry. Downloaded recordings on your device will not be deleted.`
    )) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch(
        `/api/studio/live/${encodeURIComponent(stream.id)}/delete`,
        { method: "DELETE" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete broadcast.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete broadcast.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError("Clipboard access failed. Select and copy the value manually.");
    }
  }

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Live broadcast control</h3>
          <p className="text-xs text-slate-400">
            Broadcast directly from your browser or use optional OBS publishing.
          </p>
        </div>
        <button onClick={() => void load()} className="rounded-md border border-white/15 px-3 py-1.5 text-xs hover:bg-white/10">
          Refresh status
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
          {error}
        </p>
      )}

      <section className="space-y-3 rounded-lg border border-white/10 bg-black/10 p-3">
        <div>
          <h4 className="text-sm font-semibold">Browser camera and microphone</h4>
          <p className="text-xs text-slate-400">Allow camera and microphone access when your browser asks.</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs text-slate-300">
            Camera
            <select value={videoDevice} onChange={(e) => setVideoDevice(e.target.value)} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-2">
              <option value="">Default camera</option>
              {devices.filter((d) => d.kind === "videoinput").map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || "Camera"}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs text-slate-300">
            Microphone
            <select value={audioDevice} onChange={(e) => setAudioDevice(e.target.value)} className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-2">
              <option value="">Default microphone</option>
              {devices.filter((d) => d.kind === "audioinput").map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || "Microphone"}</option>
              ))}
            </select>
          </label>
        </div>

        <video ref={previewRef} autoPlay muted playsInline className="aspect-video w-full max-w-xl rounded-lg bg-black object-contain" />

        <div className="flex flex-wrap gap-2">
          <button disabled={busy || !!publishingId} onClick={() => void startPreview()} className="rounded-md border border-white/20 px-3 py-2 text-xs disabled:opacity-50">
            {previewing ? "Restart camera preview" : "Start camera preview"}
          </button>
          {previewing && !publishingId && (
            <button onClick={stopLocalMedia} className="rounded-md border border-white/20 px-3 py-2 text-xs">
              Turn camera off
            </button>
          )}
          {publishingId && (
            <span className="rounded-md bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200">
              Browser publisher connected
            </span>
          )}
          {publishingId && recording && (
            <span className="rounded-md bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-200">
              Recording on this device
            </span>
          )}
        </div>
      </section>

      <form onSubmit={createStream} className="grid gap-2 rounded-lg border border-white/10 bg-black/10 p-3 md:grid-cols-4">
        <input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Broadcast title" className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm md:col-span-2" />
        <input maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
        <button disabled={busy} className="rounded-md bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">
          Create public stream
        </button>
      </form>

      {created && (
        <div className="space-y-2 rounded-lg border border-cyan-300/25 bg-cyan-300/5 p-3">
          <p className="text-xs font-semibold text-cyan-200">Your one-time OBS publishing URL</p>
          <code className="block break-all rounded bg-black/30 p-2 text-[11px] text-white">{created.publishUrl}</code>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void copy(created.publishUrl)} className="rounded border border-white/15 px-3 py-1.5 text-xs">Copy OBS URL</button>
            <button onClick={() => void copy(created.playbackUrl)} className="rounded border border-white/15 px-3 py-1.5 text-xs">Copy playback URL</button>
          </div>
          <p className="text-[11px] text-amber-200">{created.warning}</p>
          <p className="text-[11px] text-slate-400">In OBS: Settings → Stream → Service: Custom. Paste the full URL as the server URL and leave Stream Key empty.</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[700px] text-left text-xs">
          <thead className="bg-white/5 text-slate-400">
            <tr>
              <th className="px-3 py-2">Broadcast</th>
              <th className="px-3 py-2">Visibility</th>
              <th className="px-3 py-2">Actual status</th>
              <th className="px-3 py-2">Playback</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-3 py-5 text-center text-slate-400">Loading…</td></tr>
            ) : streams.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-5 text-center text-slate-400">No live streams created yet.</td></tr>
            ) : streams.map((stream) => (
              <tr key={stream.id} className="border-t border-white/10">
                <td className="px-3 py-2">
                  <span className="font-medium text-white">{stream.title}</span>
                  <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{stream.streamPath}</span>
                </td>
                <td className="px-3 py-2 text-slate-300">Public</td>
                <td className="px-3 py-2">
                  {stream.isLive ? <span className="font-semibold text-rose-300">LIVE</span> : stream.enabled ? <span className="text-amber-200">Waiting for publisher</span> : <span className="text-slate-500">Stopped</span>}
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => void copy(stream.playbackUrl)} className="text-cyan-200 underline">Copy HLS URL</button>
                </td>
                <td className="space-x-2 px-3 py-2">
                  {stream.enabled && (
                    <>
                      <button
                        disabled={busy || (!!publishingId && publishingId !== stream.id)}
                        onClick={() => void startBrowserLive(stream)}
                        className="rounded bg-cyan-300 px-2 py-1 text-slate-950 disabled:opacity-50"
                      >
                        {publishingId === stream.id ? "Browser LIVE" : "Start browser live"}
                      </button>
                      <button disabled={busy} onClick={() => void stopStream(stream)} className="rounded border border-rose-400/30 px-2 py-1 text-rose-200 disabled:opacity-50">
                        Stop
                      </button>
                    </>
                  )}
                  {!stream.enabled && !stream.isLive && (
                    <button
                      disabled={busy}
                      onClick={() => void deleteStream(stream)}
                      className="ml-2 rounded border border-rose-400/30 px-2 py-1 text-rose-200 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-slate-500">
        Browser camera publishing currently targets this laptop's local MediaMTX server. Public internet broadcasting requires a public server address, HTTPS/reverse proxy, firewall configuration and sufficient upload bandwidth.
      </p>
    </div>
  );
}
