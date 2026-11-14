import type { ReactNode } from "react";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export default function SiteInfoPage({ title, subtitle, children }: Props) {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <a href="/" className="font-bold tracking-wide text-white">
            VIEWERS<span className="text-cyan-400">TUBE</span>
          </a>
          <a href="/" className="text-sm text-cyan-300 hover:text-cyan-200">← Back to homepage</a>
        </header>
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">Viewers Tube</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-slate-400">{subtitle}</p>
        </div>
        <article className="space-y-7 text-sm leading-7 text-slate-300 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_a]:text-cyan-300 [&_a]:underline [&_a:hover]:text-cyan-200 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </article>
        <footer className="mt-12 border-t border-white/10 pt-5 text-xs text-slate-500">
          © 2026 Viewers Tube. Created &amp; founded by Adnan Sajjad.
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <a href="/about">About</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/contact">Contact</a>
            <a href="/creator-guidelines">Creator Guidelines</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
