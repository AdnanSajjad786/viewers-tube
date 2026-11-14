"use client";

import { useEffect, useState } from "react";

const categories = ["Music","Education","Entertainment","Gaming","News","Sports","Technology","Science","Travel","Lifestyle","Comedy","Film & Animation","People & Blogs","How-to & Style","Autos & Vehicles","Nonprofits & Activism"];

export function VideoUploadForm() {
  const [uploadType, setUploadType] = useState<"VIDEO" | "SHORT">("VIDEO");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("");
  const [visibility, setVisibility] = useState("PUBLIC");
  const [scheduledAt, setScheduledAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [scheduleMin, setScheduleMin] = useState("");

  useEffect(() => {
    setScheduleMin(
      new Date(Date.now() + 60000).toISOString().slice(0, 16)
    );
  }, []);

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setMessage("Choose a video first.");
    if (!description.trim()) return setMessage("Please enter a video description.");
    setBusy(true);
    setMessage("Preparing secure upload...");

    try {
      const initResponse = await fetch("/api/videos/upload/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description, category, language, visibility,
          scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          isShort: uploadType === "SHORT",
          contentType: file.type, size: file.size,
        }),
      });
      const init = await initResponse.json();
      if (!initResponse.ok) throw new Error(init.error || "Could not start upload.");

      setMessage("Uploading directly to your Backblaze bucket...");
      const uploadResponse = await fetch(init.uploadUrl, {
        method: "PUT", headers: init.requiredHeaders, body: file,
      });
      if (!uploadResponse.ok) throw new Error("Backblaze upload failed. Check bucket CORS settings and try again.");

      setMessage("Verifying video and queueing processing...");
      const completeResponse = await fetch("/api/videos/upload/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: init.videoId }),
      });
      const complete = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(complete.error || "Video verification failed.");

      setMessage("Upload verified. Your video is processing; it will appear in Studio when ready. ID: " + complete.videoId);
      setTitle(""); setDescription(""); setCategory(""); setLanguage(""); setVisibility("PUBLIC"); setScheduledAt(""); setFile(null); setUploadType("VIDEO");
      const input = document.getElementById("vt-video-file") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={upload} className="grid gap-4 md:grid-cols-2">
      <label className="text-sm text-slate-300 md:col-span-2">Content type
        <select value={uploadType} onChange={e => setUploadType(e.target.value as "VIDEO" | "SHORT")} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090f1d] p-3 text-white">
          <option value="VIDEO">Long-form video</option>
          <option value="SHORT">Short</option>
        </select>
        <span className="text-[11px] text-slate-500">Choose where this upload will appear in Studio.</span>
      </label>

      <label className="text-sm text-slate-300 md:col-span-2">{uploadType === "SHORT" ? "Short title" : "Video title"} <span className="text-red-300">*</span>
        <input required maxLength={180} value={title} onChange={e => setTitle(e.target.value)} placeholder="Add a clear, descriptive title" className="mt-1 w-full rounded-lg border border-white/10 bg-[#090f1d] p-3 text-white outline-none focus:border-cyan-300/60" />
      </label>

      <label className="text-sm text-slate-300 md:col-span-2">Description <span className="text-red-300">*</span>
        <textarea required maxLength={5000} rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Tell viewers what your video is about. Avoid sharing private personal information." className="mt-1 w-full rounded-lg border border-white/10 bg-[#090f1d] p-3 text-white outline-none focus:border-cyan-300/60" />
        <span className="text-[11px] text-slate-500">{description.length}/5,000 characters</span>
      </label>

      <label className="text-sm text-slate-300">Category
        <select value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090f1d] p-3 text-white">
          <option value="">Choose category</option>{categories.map(x => <option key={x}>{x}</option>)}
        </select>
      </label>

      <label className="text-sm text-slate-300">Video language
        <select value={language} onChange={e => setLanguage(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090f1d] p-3 text-white">
          <option value="">Auto / not specified</option>
          <option value="en">English</option><option value="ur">Urdu</option><option value="ar">Arabic</option><option value="hi">Hindi</option><option value="pa">Punjabi</option><option value="ps">Pashto</option><option value="sd">Sindhi</option><option value="bn">Bengali</option>
        </select>
      </label>

      <label className="text-sm text-slate-300">Visibility
        <select value={visibility} onChange={e => setVisibility(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090f1d] p-3 text-white">
          <option value="PUBLIC">Public</option><option value="UNLISTED">Unlisted</option><option value="PRIVATE">Private</option>
        </select>
      </label>

      <label className="text-sm text-slate-300">Schedule publishing (optional)
        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} min={scheduleMin || undefined} className="mt-1 w-full rounded-lg border border-white/10 bg-[#090f1d] p-3 text-white" />
        <span className="text-[11px] text-slate-500">Leave blank to publish as soon as processing is complete. Scheduled videos stay private until release.</span>
      </label>

      <label className="text-sm text-slate-300 md:col-span-2">Video file <span className="text-red-300">*</span>
        <input id="vt-video-file" required type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full rounded-lg border border-dashed border-white/20 bg-[#090f1d] p-4 text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-300 file:px-3 file:py-2 file:font-semibold file:text-slate-950" />
        <span className="text-[11px] text-slate-500">MP4, WebM or MOV · Maximum 5 GB. Uploads go directly to your verified storage bucket.</span>
      </label>

      <div className="md:col-span-2">
        <button type="submit" disabled={busy || !file} className="rounded-lg bg-cyan-300 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? "Uploading…" : uploadType === "SHORT" ? "Upload and process Short" : "Upload and process video"}
        </button>
        {message && <p role="status" className="mt-3 break-words text-sm text-cyan-200">{message}</p>}
      </div>
    </form>
  );
}
