"use client";
import { MemberPageHeader, MemberPageFooter } from "@/components/member-page-chrome";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: "/account",
      });

      if (result.error) {
        setError(result.error.message || "Invalid email or password.");
      } else {
        router.push("/account");
        router.refresh();
      }
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendVerification() {
    const address = email.trim();

    if (!address) {
      setResendMessage("Enter your email address first.");
      return;
    }

    setResendBusy(true);
    setResendMessage("");

    try {
      const result = await authClient.sendVerificationEmail({
        email: address,
        callbackURL: "/account",
      });

      setResendMessage(
        result.error
          ? result.error.message || "Unable to send verification email."
          : "If verification is needed, an email has been sent. Check your inbox and spam folder."
      );
    } catch {
      setResendMessage("Unable to send the email. Please try again.");
    } finally {
      setResendBusy(false);
    }
  }

  return (
    <>
      <MemberPageHeader variant="auth" />
<main className="min-h-screen bg-[#080b13] px-5 py-12 text-white">
      <div className="mx-auto max-w-md">
        <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Viewers Tube
        </Link>
        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Welcome back
          </p>
          <h1 className="mt-3 text-3xl font-bold">Sign in</h1>
          <p className="mt-2 text-sm text-slate-400">
            Continue to your Viewers Tube account.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
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
              <input required type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-400"
                placeholder="Your password" />
            </label>

            {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

            <button disabled={busy} type="submit"
              className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={resendVerification}
              disabled={resendBusy}
              className="text-sm text-cyan-300 hover:underline disabled:opacity-50"
            >
              {resendBusy ? "Sending..." : "Resend verification email"}
            </button>
            {resendMessage && (
              <p role="status" className="mt-3 text-sm text-slate-300">
                {resendMessage}
              </p>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate-400">
            New to Viewers Tube? <Link className="text-cyan-300 hover:underline" href="/signup">Join free</Link>
          </p>
        </section>
      </div>
    </main>
      <MemberPageFooter />
    </>
  );
}
