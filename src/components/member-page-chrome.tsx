import Image from "next/image";
import Link from "next/link";

type Variant = "auth" | "account";

export function MemberPageHeader({ variant }: { variant: Variant }) {
  const logo = variant === "account"
    ? "/images/viewers-tube-account-logo.png"
    : "/images/viewers-tube-auth-logo.png";

  return (
    <header className="border-b border-white/10 bg-[#0b1020]/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[76px] max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="Viewers Tube home">
          <Image
            src={logo}
            alt="Viewers Tube"
            width={52}
            height={52}
            priority
            className="h-11 w-11 rounded-xl object-contain"
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold tracking-[0.13em] text-white sm:text-base">
              VIEWERS <span className="text-cyan-300">TUBE</span>
            </span>
            <span className="mt-0.5 block text-[10px] tracking-[0.16em] text-slate-400">
              WATCH · CREATE · SHARE
            </span>
          </span>
        </Link>

        <nav aria-label="Member navigation" className="flex shrink-0 items-center gap-3 text-xs font-medium text-slate-300 sm:gap-6 sm:text-sm">
          <Link href="/" className="transition hover:text-cyan-300">Home</Link>
          <Link href="/creator-guidelines" className="hidden transition hover:text-cyan-300 sm:inline">Guidelines</Link>
          <Link href="/contact" className="hidden transition hover:text-cyan-300 sm:inline">Help</Link>
          {variant === "auth" ? (
            <Link
              href="/signup"
              className="rounded-lg bg-cyan-400 px-3 py-2 font-bold text-slate-950 transition hover:bg-cyan-300 sm:px-4"
            >
              Join free
            </Link>
          ) : (
            <Link href="/contact" className="rounded-lg border border-white/15 px-3 py-2 transition hover:border-cyan-300 hover:text-cyan-200 sm:px-4">
              Support
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

export function MemberPageFooter() {
  return (
    <footer className="mt-12 border-t border-white/10 bg-black/20">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-7 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Viewers Tube. All rights reserved.</p>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-3">
          <Link href="/" className="hover:text-cyan-300">Home</Link>
          <Link href="/creator-guidelines" className="hover:text-cyan-300">Creator Guidelines</Link>
          <Link href="/terms" className="hover:text-cyan-300">Terms</Link>
          <Link href="/privacy" className="hover:text-cyan-300">Privacy</Link>
          <Link href="/contact" className="hover:text-cyan-300">Contact</Link>
        </nav>
      </div>
    </footer>
  );
}
