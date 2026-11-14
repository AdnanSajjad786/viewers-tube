"use client";

import { useEffect, useState } from "react";

type Connection = {
  region: string;
  bucketName: string;
  prefix: string;
  status: string;
  verifiedAt: string | null;
};

export function StorageConnectionForm() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [region, setRegion] = useState("us-west-004");
  const [bucketName, setBucketName] = useState("viewers-tube-videos");
  const [prefix, setPrefix] = useState("viewers-tube");
  const [keyId, setKeyId] = useState("");
  const [applicationKey, setApplicationKey] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/storage-connection")
      .then((response) => response.json())
      .then((data) => {
        if (data.connection) {
          setConnection(data.connection);
          setRegion(data.connection.region);
          setBucketName(data.connection.bucketName);
          setPrefix(data.connection.prefix);
        }
      })
      .catch(() => setMessage("Could not load your storage connection."));
  }, []);

  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/storage-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region, bucketName, prefix, keyId, applicationKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Connection verification failed.");
        return;
      }

      setConnection(data.connection);
      setKeyId("");
      setApplicationKey("");
      setMessage("Your Backblaze bucket is connected and verified.");
    } catch {
      setMessage("Connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-7 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-5">
      <h2 className="text-lg font-bold text-cyan-200">Backblaze B2 Storage Connection</h2>
      <p className="mt-2 text-sm text-slate-300">
        Connect your own private B2 bucket. Your videos will be stored in your
        bucket, not on the Viewers Tube application server.
      </p>

      {connection && (
        <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm">
          <p className="font-semibold text-emerald-300">
            Storage status: {connection.status}
          </p>
          <p className="mt-1 text-slate-300">Bucket: {connection.bucketName}</p>
          <p className="text-slate-300">Region: {connection.region}</p>
          <p className="text-slate-300">Folder: {connection.prefix || "(bucket root)"}</p>
          {connection.verifiedAt && (
            <p className="mt-1 text-xs text-slate-400">
              Verified: {new Date(connection.verifiedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <form onSubmit={connect} className="mt-4 space-y-3">
        <label className="block text-sm text-slate-300">
          Backblaze region
          <select
            value={region}
            onChange={(event) => setRegion(event.target.value)}
            className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 p-3 text-white"
          >
            <option value="us-west-004">US West 004</option>
            <option value="us-west-001">US West 001</option>
            <option value="us-west-002">US West 002</option>
            <option value="us-east-005">US East 005</option>
            <option value="eu-central-003">EU Central 003</option>
          </select>
        </label>

        <label className="block text-sm text-slate-300">
          Bucket name
          <input
            required
            value={bucketName}
            onChange={(event) => setBucketName(event.target.value)}
            autoComplete="off"
            className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 p-3 text-white"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Storage folder prefix
          <input
            value={prefix}
            onChange={(event) => setPrefix(event.target.value)}
            placeholder="viewers-tube"
            className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 p-3 text-white"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Backblaze Key ID
          <input
            required
            value={keyId}
            onChange={(event) => setKeyId(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 p-3 text-white"
          />
        </label>

        <label className="block text-sm text-slate-300">
          Backblaze Application Key
          <input
            required
            type="password"
            value={applicationKey}
            onChange={(event) => setApplicationKey(event.target.value)}
            autoComplete="new-password"
            spellCheck={false}
            className="mt-1 w-full rounded-lg border border-white/15 bg-slate-900 p-3 text-white"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
        >
          {loading ? "Verifying bucket..." : "Connect and verify storage"}
        </button>
      </form>

      {message && (
        <p role="status" className="mt-3 text-sm text-cyan-200">{message}</p>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-400">
        Your Application Key is encrypted before it is saved and is never
        returned to this page. Use a restricted application key for this bucket.
        Never enter your Backblaze master account password here.
      </p>
    </section>
  );
}
