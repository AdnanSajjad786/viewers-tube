"use client";

import { useEffect, useState, type FormEvent } from "react";

type Connection = {
  id: string;
  label: string | null;
  region: string;
  bucketName: string;
  prefix: string;
  status: string;
  isDefault: boolean;
  verifiedAt: string | null;
  usedBytes: number | null;
  usageError: boolean;
};

const REFERENCE_BYTES = 10 * 1024 * 1024 * 1024;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function StorageConnectionForm() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [region, setRegion] = useState("us-west-004");
  const [bucketName, setBucketName] = useState("");
  const [prefix, setPrefix] = useState("viewers-tube");
  const [label, setLabel] = useState("");
  const [keyId, setKeyId] = useState("");
  const [applicationKey, setApplicationKey] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  async function loadConnections() {
    try {
      const response = await fetch("/api/storage-connection", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Could not load storage.");

      setConnections(Array.isArray(data.connections) ? data.connections : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load storage.");
    } finally {
      setLoadingConnections(false);
    }
  }

  useEffect(() => {
    let active = true;

    fetch("/api/storage-connection", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load storage.");
        if (active) setConnections(Array.isArray(data.connections) ? data.connections : []);
      })
      .catch((error) => {
        if (active) setMessage(error instanceof Error ? error.message : "Could not load storage.");
      })
      .finally(() => {
        if (active) setLoadingConnections(false);
      });

    return () => { active = false; };
  }, []);

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/storage-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region,
          bucketName,
          prefix,
          label,
          keyId,
          applicationKey,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Connection verification failed.");
      }

      setKeyId("");
      setApplicationKey("");
      setLabel("");
      setBucketName("");
      await loadConnections();
      setShowForm(false);
      setMessage("Backblaze account connected and verified. Existing connections were preserved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-7 rounded-2xl border border-cyan-400/20 bg-slate-950/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Backblaze storage</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Store your media in your own private Backblaze buckets. Connect
            multiple Backblaze accounts under this Viewers Tube login.
          </p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">
          {connections.length} connected
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {loadingConnections ? (
          <p className="rounded-lg border border-white/10 p-3 text-sm text-slate-400">
            Loading storage accounts…
          </p>
        ) : connections.length === 0 ? (
          <div className="rounded-xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.04] p-4">
            <p className="text-sm font-semibold text-white">
              No Backblaze account connected yet
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Connect your first bucket to store videos, Shorts, thumbnails,
              advertising images, podcasts and other supported media.
            </p>
          </div>
        ) : (
          connections.map((item, index) => {
            const used = item.usedBytes;
            const percent =
              used === null
                ? 0
                : Math.min(100, (used / REFERENCE_BYTES) * 100);
            const verified = item.status === "VERIFIED";

            return (
              <article
                key={item.id}
                className="rounded-xl border border-white/10 bg-white/[0.025] p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">
                      Backblaze account {index + 1}
                    </h3>
                    {item.isDefault && (
                      <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-200">
                        Default
                      </span>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      verified
                        ? "bg-emerald-400/10 text-emerald-300"
                        : "bg-amber-400/10 text-amber-200"
                    }`}
                  >
                    {verified ? "● Connected" : "● Not connected"}
                  </span>
                </div>

                <p className="mt-1 truncate text-xs text-slate-400">
                  {item.label || item.bucketName} · {item.region}
                </p>

                <div className="mt-3 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-slate-400">Storage used</span>
                  <span className="text-sm font-semibold tabular-nums text-white">
                    {used === null
                      ? item.usageError
                        ? "Usage unavailable"
                        : "Not measured"
                      : `${formatBytes(used)} used`}
                    {used !== null && (
                      <span className="font-normal text-slate-400">
                        {" "} / 10 GB reference
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {item.usageError && (
                  <p className="mt-1.5 text-[11px] text-amber-200">
                    Could not read bucket usage. Check the application&apos;s list
                    and read permissions.
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span>Bucket: {item.bucketName}</span>
                  <span>Folder: {item.prefix || "Bucket root"}</span>
                </div>

                {item.verifiedAt && (
                  <p className="mt-1 text-[10px] text-slate-500">
                    Verified {new Date(item.verifiedAt).toLocaleString()}
                  </p>
                )}
              </article>
            );
          })
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-300"
        >
          {showForm
            ? "Close connection form"
            : connections.length
              ? "+ Connect another Backblaze account"
              : "Connect Backblaze account"}
        </button>

        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="rounded-lg border border-cyan-400/30 px-3 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10"
        >
          How to set up storage
        </button>

        <a
          href="https://www.backblaze.com/docs/cloud-storage-get-started-with-a-backblaze-integration"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-white/15 px-3 py-2.5 text-xs font-medium text-cyan-200 hover:bg-white/5"
        >
          Backblaze setup guide ↗
        </a>
      </div>

      {showGuide && (
        <div
          role="presentation"
          onClick={() => setShowGuide(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="backblaze-guide-title"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[#0b1220] p-5 shadow-2xl"
          >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-3">
          <div>
            <h3 id="backblaze-guide-title" className="text-base font-bold text-white">
              Backblaze setup guide
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Follow these steps to connect your own private storage.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(false)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <ol className="mt-3 list-decimal space-y-3 pl-4 text-xs leading-5 text-slate-300">
          <li>
            <strong>Create your Backblaze account.</strong> Open the{" "}
            <a className="text-cyan-300 underline" href="https://www.backblaze.com/sign-up/cloud-storage?referrer=getstarted" target="_blank" rel="noopener noreferrer">
              official Backblaze sign-up page ↗
            </a>
            . Choose <strong>B2 Cloud Storage</strong>, enter your email address,
            and verify it using the message Backblaze sends you. Complete account
            setup by creating your password. Choose your storage region (for
            example, US-West if that is the region you intend to use), review and
            accept the Terms of Service, and finish creating your account.
          </li>
          <li>
            <strong>Sign in to Backblaze.</strong> Go to the{" "}
            <a className="text-cyan-300 underline" href="https://secure.backblaze.com/user_signin.htm" target="_blank" rel="noopener noreferrer">
              Backblaze sign-in page ↗
            </a>
            . Enter your email address and password. If Backblaze sends a
            security code to your email, retrieve it and enter it to complete
            sign-in.
          </li>
          <li>
            <strong>Create a private bucket.</strong> Open{" "}
            <a className="text-cyan-300 underline" href="https://secure.backblaze.com/b2_buckets.htm" target="_blank" rel="noopener noreferrer">
              B2 Buckets ↗
            </a>
            , choose to create a bucket, and enter a globally unique bucket name,
            such as <code>viewers-tube-yourname</code>. Choose <strong>Private</strong>
            {" "}rather than Public, use the region assigned to your account, and
            create the bucket. See the{" "}
            <a className="text-cyan-300 underline" href="https://www.backblaze.com/docs/cloud-storage-create-and-manage-buckets" target="_blank" rel="noopener noreferrer">
              official bucket instructions ↗
            </a>
            .
          </li>
          <li>
            <strong>Create a restricted Application Key.</strong> Open
            Application Keys in the Backblaze console and choose to add a new
            key. Give it a name such as <code>viewers-tube</code>. Select the
            bucket you just created, and grant the Read and Write permissions
            needed for media storage. Use a standard, bucket-restricted key;
            do not use your master application key. If Backblaze offers a
            file-prefix restriction, use the same folder prefix you plan to
            enter in Viewers Tube. Read the{" "}
            <a className="text-cyan-300 underline" href="https://www.backblaze.com/docs/en/cloud-storage-application-keys" target="_blank" rel="noopener noreferrer">
              official Application Key guide ↗
            </a>
            .
          </li>
          <li>
            <strong>Copy and protect the key details.</strong> Copy the Key ID
            and Application Key when Backblaze displays them. The secret
            Application Key is shown only once. Store it somewhere secure until
            you have connected the bucket. Never email it, share it with
            support, or enter it into a message. Viewers Tube will never ask
            for your Backblaze password or master key.
          </li>
          <li>
            <strong>Configure bucket CORS for browser uploads.</strong> In
            your Backblaze account, configure CORS for your private bucket
            using its S3-Compatible API settings. Use the <code>PUT</code>
            method and allow the <code>Content-Type</code> request header.
            Allow your exact Viewers Tube website origin.

            <strong>If you are using the local development website:</strong>{" "}
            <code>http://localhost:3001</code>.{" "}
            <strong>If you are using the live Viewers Tube website:</strong>{" "}
            <code>https://web.adnansajjadnew786.workers.dev</code>.

            Creators accessing the live website from Pakistan, the USA, the
            UK or any other country must use the same production origin.
            Your country or physical location does not change this setting.
            Do not use <code>localhost</code> for live website uploads. Do not
            use a wildcard origin for a private production setup. If you use
            more than one website origin, configure each exact origin
            separately. Follow Backblaze&apos;s{" "}
            <a className="text-cyan-300 underline" href="https://www.backblaze.com/docs/cloud-storage-cross-origin-resource-sharing-rules" target="_blank" rel="noopener noreferrer">
              CORS documentation ↗
            </a>
            . CORS settings belong to the S3-compatible API, not the Native API.
          </li>
          <li>
            <strong>Connect the bucket to Viewers Tube.</strong> Return to your
            Viewers Tube Account page at <code>http://localhost:3001/account</code>
            {" "}during local development. Open the storage connection form and
            enter all five values: <strong>Backblaze region, Bucket name,
            Storage folder prefix, Key ID, and Application Key</strong>. The
            folder prefix is the folder path Viewers Tube should use inside
            your bucket; use the same prefix you selected for the key, if you
            restricted it. Submit the form and wait for the successful
            verification message.
          </li>
          <li>
            <strong>Wait for Creator application review, if applicable.</strong>
            A successful storage connection means the bucket credentials were
            verified. It does not itself approve a Creator application or
            activate Creator privileges. An Admin must review and approve a
            pending application separately.
          </li>
        </ol>

        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          Use this storage for videos, Shorts, thumbnails, advertising images,
          podcast media and other supported uploads. The 10 GB figure is a
          free-tier reference, not a guaranteed quota; actual limits and
          billing depend on your Backblaze plan. Usage shown here is measured
          from objects under the configured folder prefix.
        </p>

        <p className="mt-2 text-xs text-slate-400">
          Need help?{" "}
          <a href="/contact" className="text-cyan-300 underline">
            Contact Viewers Tube support
          </a>.
        </p>
          <div className="mt-4 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-3 text-xs leading-5 text-slate-300">
            <strong className="text-cyan-200">Your storage, your credentials.</strong>
            Viewers Tube needs a bucket-scoped Backblaze Application Key to store and
            retrieve your media. The key is encrypted by Viewers Tube. Never enter
            your Backblaze account password or master key here.
            <br /><br />
            You can connect multiple Backblaze accounts using different Backblaze
            email addresses under this same Viewers Tube login. Add another account
            before your available storage is exhausted. Each account has its own
            bucket and credentials. Actual storage limits depend on your Backblaze plan.
          </div>
          </section>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={connect}
          className="mt-4 space-y-3 rounded-xl border border-cyan-400/20 bg-black/20 p-4"
        >
          <div>
            <h3 className="text-sm font-semibold text-white">
              Connect a Backblaze account
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Enter the details for one bucket. Repeat for additional accounts.
            </p>
          </div>

          <label className="block text-xs text-slate-300">
            Account label (optional)
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              placeholder={`Backblaze account ${connections.length + 1}`}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900 p-2.5 text-sm text-white"
            />
          </label>

          <label className="block text-xs text-slate-300">
            Backblaze region
            <select
              required
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900 p-2.5 text-sm text-white"
            >
              <option value="us-west-004">US West 004</option>
              <option value="us-west-001">US West 001</option>
              <option value="us-west-002">US West 002</option>
              <option value="us-east-005">US East 005</option>
              <option value="eu-central-003">EU Central 003</option>
            </select>
          </label>

          <label className="block text-xs text-slate-300">
            Bucket name
            <input
              required
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              autoComplete="off"
              placeholder="your-private-bucket"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900 p-2.5 text-sm text-white"
            />
          </label>

          <label className="block text-xs text-slate-300">
            Storage folder prefix
            <input
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="viewers-tube"
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900 p-2.5 text-sm text-white"
            />
          </label>

          <label className="block text-xs text-slate-300">
            Backblaze Key ID
            <input
              required
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900 p-2.5 text-sm text-white"
            />
          </label>

          <label className="block text-xs text-slate-300">
            Backblaze Application Key
            <input
              required
              type="password"
              value={applicationKey}
              onChange={(e) => setApplicationKey(e.target.value)}
              autoComplete="new-password"
              spellCheck={false}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-900 p-2.5 text-sm text-white"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-50"
          >
            {loading ? "Verifying bucket…" : "Verify and connect account"}
          </button>

          <p className="text-[11px] leading-5 text-slate-500">
            The Application Key is encrypted before it is saved and is never
            returned to this page. Use a bucket-restricted Read and Write key.
            Never enter your Backblaze master account password.
          </p>
        </form>
      )}

      {message && (
        <p role="status" className="mt-3 text-xs leading-5 text-cyan-200">
          {message}
        </p>
      )}
    </section>
  );
}
