"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupType, setSignupType] = useState<"VIEWER" | "CREATOR">("VIEWER");
  const [creatorAgreementAccepted, setCreatorAgreementAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
      setError("Username must be 3–24 characters: letters, numbers or underscores.");
      return;
    }
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (signupType === "CREATOR" && !creatorAgreementAccepted) {
      setError("You must accept the Creator Agreement before registering as a Creator.");
      return;
    }

    setBusy(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        username: cleanUsername,
        email: email.trim(),
        password,
        signupType,
        ...(signupType === "CREATOR"
          ? { creatorAgreementVersion: "VIEWERS_TUBE_CREATOR_2026_01" }
          : {}),
        callbackURL: "/account",
      });

      if (result.error) {
        setError(result.error.message || "Unable to create your account.");
      } else {
        router.push("/account");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#080b13] px-5 py-12 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Viewers Tube
        </Link>
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Join the community
          </p>
          <h1 className="mt-3 text-3xl font-bold">Create your free account</h1>
          <p className="mt-2 text-sm text-slate-400">
            Discover videos, build your channel and connect with creators.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Choose your account type</p>
              <div className="grid grid-cols-2 gap-3">
                <label className={`cursor-pointer rounded-xl border p-3 ${signupType === "VIEWER" ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-black/20"}`}>
                  <input type="radio" name="signupType" value="VIEWER"
                    checked={signupType === "VIEWER"}
                    onChange={() => setSignupType("VIEWER")}
                    className="mr-2 accent-cyan-400" />
                  <span className="font-semibold">Viewer</span>
                  <p className="mt-1 text-xs text-slate-400">Watch, discover and follow videos.</p>
                </label>
                <label className={`cursor-pointer rounded-xl border p-3 ${signupType === "CREATOR" ? "border-cyan-400 bg-cyan-400/10" : "border-white/10 bg-black/20"}`}>
                  <input type="radio" name="signupType" value="CREATOR"
                    checked={signupType === "CREATOR"}
                    onChange={() => setSignupType("CREATOR")}
                    className="mr-2 accent-cyan-400" />
                  <span className="font-semibold">Creator</span>
                  <p className="mt-1 text-xs text-slate-400">Create your channel and prepare to publish.</p>
                </label>
              </div>
            </div>
            <label className="block text-sm">
              Display name
              <input required minLength={2} maxLength={60} value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400"
                placeholder="Your name" />
            </label>
            <label className="block text-sm">
              Username
              <input required minLength={3} maxLength={24} value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400"
                placeholder="your_username" />
            </label>
            <label className="block text-sm">
              Email address
              <input required type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400"
                placeholder="you@example.com" />
            </label>
            <label className="block text-sm">
              Password
              <input required type="password" minLength={8} maxLength={128} value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400"
                placeholder="At least 8 characters" />
            </label>

            {signupType === "CREATOR" && (
              <section className="space-y-3 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-4">
                <h2 className="font-semibold text-cyan-200">Viewers Tube Creator Agreement</h2>
                <a href="/creator-guidelines" target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-cyan-300 underline hover:text-cyan-200">
                  Read full Creator Guidelines ↗
                </a>
                <p className="text-xs leading-5 text-slate-300">
                  By registering as a Creator, you agree to follow these rules:
                </p>
                <ul className="list-disc space-y-2 pl-5 text-xs leading-5 text-slate-300">
                  <li>No nudity, pornography, or sexually explicit material.</li>
                  <li>No obscene, excessively profane, abusive, threatening, or harassing content.</li>
                  <li>No hate, exploitation, child sexual abuse material, or promotion of violence.</li>
                  <li>No illegal material, scams, impersonation, spam, or deliberately misleading content.</li>
                  <li>Only upload content you own or are legally authorized to publish.</li>
                  <li>Respect privacy, intellectual property, applicable laws, and other people's rights.</li>
                  <li>Do not evade moderation, suspensions, or account restrictions using another account.</li>
                </ul>
                <p className="text-xs leading-5 text-slate-400">
                  Confirmed violations can result in video removal and Creator upload suspensions:
                  first strike 7 days, second 14 days, third 30 days, and fourth strike termination
                  of Creator privileges. You will receive a notice and may appeal a strike.
                  Reports or automated detection alone do not establish a violation; enforcement
                  requires confirmation under the platform's moderation process.
                </p>
                <label className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={creatorAgreementAccepted}
                    onChange={(event) => setCreatorAgreementAccepted(event.target.checked)}
                    className="mt-1 accent-cyan-400"
                  />
                  <span>
                    I have read and agree to the Viewers Tube Creator Agreement.
                    <span className="mt-1 block text-xs text-slate-400">
                      Agreement version: VIEWERS_TUBE_CREATOR_2026_01
                    </span>
                  </span>
                </label>
              </section>
            )}

            {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

            <button disabled={busy} type="submit"
              className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">
              {busy ? "Creating account…" : "Create free account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already registered? <Link className="text-cyan-300 hover:underline" href="/login">Sign in</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
