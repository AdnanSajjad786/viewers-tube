import { MemberPageHeader, MemberPageFooter } from "@/components/member-page-chrome";
import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LogoutButton } from "./logout-button";
import { ResendVerificationButton } from "./resend-verification-button";
import { CreatorAccountActions } from "./creator-account-actions";
import { ChannelEditor } from "./channel-editor";
import { StorageConnectionForm } from "./storage-connection-form";

export default function AccountPage() {
  return (
    <>
      <MemberPageHeader variant="account" />
<main className="min-h-screen bg-[#080b13] px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Viewers Tube home
        </Link>
        <Suspense fallback={<p className="mt-10 text-slate-400">Loading your account…</p>}>
          <AccountDetails />
        </Suspense>
      </div>
    </main>
      <MemberPageFooter />
    </>
  );
}

async function AccountDetails() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/login");

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      signupType: true,
      creatorAgreementVersion: true,
      creatorAgreementAcceptedAt: true,
      creatorApplicationStatus: true,
      creatorApplicationSubmittedAt: true,
      creatorApplicationReviewNote: true,
      creatorSuspendedUntil: true,
      creatorTerminatedAt: true,
      channel: {
        select: { name: true, slug: true, description: true },
      },
      moderationStrikes: {
        where: { status: "ACTIVE" },
        orderBy: { issuedAt: "desc" },
        take: 10,
        select: {
          id: true,
          strikeNumber: true,
          policyCode: true,
          reason: true,
          suspensionDays: true,
          issuedAt: true,
          suspensionEndsAt: true,
          appeal: { select: { status: true } },
        },
      },
    },
  });

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-7">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
        Your Viewers Tube account
      </p>
      <h1 className="mt-3 text-3xl font-bold">
        Welcome, {session.user.name}
      </h1>
      {profile?.role && (
        <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold tracking-wider ${
          profile.role === "ADMIN"
            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
            : profile.role === "CREATOR"
              ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
              : "border-slate-400/40 bg-slate-400/10 text-slate-300"
        }`}>
          {profile.role}
        </span>
      )}
      <p className="mt-2 text-slate-400">
        Your account is ready to use.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Display name</p>
          <p className="mt-1 font-medium">{session.user.name}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Email</p>
          <p className="mt-1 break-all font-medium">{session.user.email}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Username</p>
          <p className="mt-1 font-medium">
            {"username" in session.user ? String(session.user.username) : "Set during registration"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-xs text-slate-400">Email verification</p>
          <p className="mt-1 font-medium">
            {session.user.emailVerified ? "Verified" : "Not yet verified"}
          </p>
        </div>
      </div>

      {profile?.creatorApplicationStatus === "PENDING" && (
        <section className="mt-7 rounded-xl border border-amber-400/30 bg-amber-400/5 p-5">
          <h2 className="font-semibold text-amber-200">Creator application pending</h2>
          <p className="mt-2 text-sm text-slate-300">
            Your application is awaiting Admin review. Your account remains a Viewer until approval.
          </p>
          {profile.creatorApplicationSubmittedAt && (
            <p className="mt-2 text-xs text-slate-400">
              Submitted: {profile.creatorApplicationSubmittedAt.toLocaleString()}
            </p>
          )}
        </section>
      )}

      {profile?.creatorApplicationStatus === "REJECTED" && (
        <section className="mt-7 rounded-xl border border-rose-400/30 bg-rose-400/5 p-5">
          <h2 className="font-semibold text-rose-200">Creator application not approved</h2>
          {profile.creatorApplicationReviewNote && (
            <p className="mt-2 text-sm text-slate-300">
              Admin note: {profile.creatorApplicationReviewNote}
            </p>
          )}
          <p className="mt-2 text-sm text-slate-300">
            You may submit a new application after reviewing the feedback.
          </p>
        </section>
      )}

      {profile?.role === "VIEWER" &&
        profile.creatorApplicationStatus !== "PENDING" &&
        session.user.emailVerified && (
          <CreatorAccountActions mode="upgrade" strikes={[]} />
        )}

      {profile?.role === "CREATOR" && !profile.creatorTerminatedAt && (
        <CreatorAccountActions
          mode="appeals"
          strikes={profile.moderationStrikes.map((strike) => ({
            id: strike.id,
            strikeNumber: strike.strikeNumber,
            reason: strike.reason,
            appealStatus: strike.appeal?.status ?? null,
          }))}
        />
      )}

      {(profile?.role === "ADMIN" ||
        profile?.role === "CREATOR" ||
        (profile?.signupType === "CREATOR" &&
          profile?.creatorApplicationStatus === "PENDING")) && (
        <StorageConnectionForm />
      )}

      {(profile?.role === "ADMIN" || profile?.role === "CREATOR") && (
        <Link
          href="/studio"
          className="mt-7 inline-flex rounded-lg bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 hover:bg-cyan-300"
        >
          Open Studio · Upload and manage videos →
        </Link>
      )}

      {profile?.role === "ADMIN" && (
        <Link
          href="/admin"
          className="mt-7 inline-flex rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-5 py-3 text-sm font-bold text-emerald-200 hover:bg-emerald-400/20"
        >
          Open Admin Dashboard →
        </Link>
      )}

      {profile?.role === "ADMIN" && (
        <section className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-5">
          <h2 className="font-semibold text-emerald-300">Platform administrator</h2>
          <p className="mt-2 text-sm text-slate-300">
            Your account has full platform administrator privileges. Admin
            access is free and does not require a paid subscription. Viewers Tube
            remains subject to applicable laws and the terms of third-party
            services it uses.
          </p>
        </section>
      )}

      {profile?.role === "CREATOR" && (
        <section className="mt-7 space-y-4 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-5">
          <div>
            <h2 className="text-xl font-bold text-cyan-200">Creator dashboard</h2>
            <p className="mt-1 text-sm text-slate-300">
              {profile.channel
                ? `Channel: ${profile.channel.name} (@${profile.channel.slug})`
                : "Your channel setup is pending."}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Creator Agreement: {profile.creatorAgreementAcceptedAt
                ? `Accepted ${profile.creatorAgreementAcceptedAt.toLocaleDateString()}`
                : "Acceptance record not found"}
              {profile.creatorAgreementVersion
                ? ` · ${profile.creatorAgreementVersion}`
                : ""}
            </p>

            <Link
              href="/creator-guidelines"
              className="inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200"
            >
              Read Creator Guidelines →
            </Link>

            <details className="rounded-lg border border-cyan-400/20 bg-black/20 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                Review full Creator Agreement
              </summary>

              <div className="mt-4 space-y-3 text-xs leading-5 text-slate-300">
                <p>By registering as a Creator, you agree to follow these rules:</p>

                <ul className="list-disc space-y-2 pl-5">
                  <li>No nudity, pornography, or sexually explicit material.</li>
                  <li>No obscene, excessively profane, abusive, threatening, or harassing content.</li>
                  <li>No hate, exploitation, child sexual abuse material, or promotion of violence.</li>
                  <li>No illegal material, scams, impersonation, spam, or deliberately misleading content.</li>
                  <li>Only upload content you own or are legally authorized to publish.</li>
                  <li>Respect privacy, intellectual property, applicable laws, and other people&apos;s rights.</li>
                  <li>Do not evade moderation, suspensions, or account restrictions using another account.</li>
                </ul>

                <p className="text-slate-400">
                  Confirmed violations can result in video removal and Creator upload suspensions:
                  first strike 7 days, second 14 days, third 30 days, and fourth strike termination
                  of Creator privileges. You will receive a notice and may appeal a strike.
                  Reports or automated detection alone do not establish a violation; enforcement
                  requires confirmation under the platform&apos;s moderation process.
                </p>

                <p className="border-t border-white/10 pt-3 text-slate-400">
                  Agreement version: VIEWERS_TUBE_CREATOR_2026_02
                </p>
              </div>
            </details>
          </div>

          {profile.channel && (
            <ChannelEditor
              initialName={profile.channel.name}
              initialDescription={profile.channel.description || ""}
            />
          )}

          {profile.creatorTerminatedAt && (
            <a
              href="/account/termination-appeal"
              className="inline-flex rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/20"
            >
              Review termination and submit an appeal
            </a>
          )}

          {profile.creatorTerminatedAt ? (
            <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
              Creator privileges have been terminated. Contact platform support
              if you believe this decision was made in error.
            </p>
          ) : profile.creatorSuspendedUntil && profile.creatorSuspendedUntil > new Date() ? (
            <p className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
              Creator uploads are suspended until{" "}
              {profile.creatorSuspendedUntil.toLocaleString()}.
            </p>
          ) : (
            <p className="text-sm text-emerald-300">
              No current Creator suspension is recorded.
            </p>
          )}

          <div>
            <h3 className="font-semibold">Moderation history</h3>
            <p className="mt-1 text-xs text-slate-400">
              Active confirmed strikes: {profile.moderationStrikes.length}
            </p>
            {profile.moderationStrikes.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">
                No active strikes recorded.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {profile.moderationStrikes.map((strike) => (
                  <li key={strike.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <p className="text-sm font-semibold">
                      Strike {strike.strikeNumber} · {strike.policyCode}
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{strike.reason}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {strike.suspensionDays}-day suspension · Issued{" "}
                      {strike.issuedAt.toLocaleDateString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-slate-400">
            If you receive a moderation decision, follow the appeal instructions
            in its notification. Uploading remains subject to Creator eligibility.
          </p>
        </section>
      )}

      {!session.user.emailVerified && (
        <ResendVerificationButton email={session.user.email} />
      )}

      <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/" className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
          Explore videos
        </Link>
        <LogoutButton />
      </div>
    </section>
  );
}
