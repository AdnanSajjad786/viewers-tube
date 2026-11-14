"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function ResendVerificationButton({ email }: { email: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function resend() {
    setPending(true);
    setMessage("");

    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: "/account",
      });

      if (result.error) {
        setMessage(result.error.message || "Unable to send verification email.");
      } else {
        setMessage("Verification email sent. Check your inbox and spam folder.");
      }
    } catch {
      setMessage("Email sending failed. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={resend}
        disabled={pending}
        className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
      >
        {pending ? "Sending..." : "Resend verification email"}
      </button>
      {message && (
        <p role="status" className="mt-3 text-sm text-cyan-300">
          {message}
        </p>
      )}
    </div>
  );
}
