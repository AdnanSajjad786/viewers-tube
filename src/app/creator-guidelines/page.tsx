import Link from "next/link";

export default function CreatorGuidelinesPage() {
  return (
    <main className="min-h-screen bg-[#080b13] px-5 py-12 text-white">
      <article className="mx-auto max-w-3xl">
        <Link href="/account" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Back to your account
        </Link>

        <header className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Viewers Tube
          </p>
          <h1 className="mt-3 text-3xl font-bold">Creator Guidelines</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            These guidelines explain the rules for publishing content as a
            Viewers Tube Creator. Please review them regularly.
          </p>
        </header>

        <section className="mt-8 rounded-2xl border border-cyan-400/30 bg-cyan-400/5 p-6">
          <h2 className="text-xl font-bold text-cyan-200">
            Viewers Tube Creator Agreement
          </h2>
          <p className="mt-3 text-sm text-slate-300">
            By registering as a Creator, you agree to follow these rules:
          </p>
          <ul className="mt-4 list-disc space-y-3 pl-5 text-sm leading-6 text-slate-300">
            <li>No nudity, pornography, or sexually explicit material.</li>
            <li>No obscene, excessively profane, abusive, threatening, or harassing content.</li>
            <li>No hate, exploitation, child sexual abuse material, or promotion of violence.</li>
            <li>No illegal material, scams, impersonation, spam, or deliberately misleading content.</li>
            <li>Only upload content you own or are legally authorized to publish.</li>
            <li>Respect privacy, intellectual property, applicable laws, and other people's rights.</li>
            <li>Do not evade moderation, suspensions, or account restrictions using another account.</li>
          </ul>
          <p className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-400">
            Agreement version: VIEWERS_TUBE_CREATOR_2026_01
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Strikes and suspensions</h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Confirmed violations can result in video removal and Creator
            upload suspensions:
          </p>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="rounded-lg bg-black/20 p-3">First strike — 7-day suspension</li>
            <li className="rounded-lg bg-black/20 p-3">Second strike — 14-day suspension</li>
            <li className="rounded-lg bg-black/20 p-3">Third strike — 30-day suspension</li>
            <li className="rounded-lg bg-black/20 p-3">Fourth strike — termination of Creator privileges</li>
          </ul>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            You will receive a notice and may appeal a strike. Reports or
            automated detection alone do not establish a violation;
            enforcement requires confirmation under the platform's
            moderation process.
          </p>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-xl font-bold">Moderation and appeals</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-300">
            <li>Read the moderation notice carefully if you receive a decision.</li>
            <li>Follow the appeal instructions provided with that notice.</li>
            <li>Explain clearly why you believe the decision should be reviewed.</li>
            <li>Do not use another account to evade a restriction or suspension.</li>
          </ul>
          <p className="mt-4 text-sm text-slate-400">
            Uploading remains subject to Creator eligibility and any active
            restrictions on your account.
          </p>
        </section>

        <div className="mt-8">
          <Link href="/account" className="inline-flex rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
            Return to Creator dashboard
          </Link>
        </div>
      </article>
    </main>
  );
}
