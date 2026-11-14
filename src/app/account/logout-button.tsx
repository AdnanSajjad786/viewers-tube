"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await authClient.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button onClick={logout} disabled={busy}
      className="rounded-xl border border-white/15 px-5 py-3 text-sm hover:bg-white/10 disabled:opacity-60">
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
