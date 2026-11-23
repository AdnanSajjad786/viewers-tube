import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdminOverview } from "@/lib/admin-overview";



function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-white">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) redirect("/login");

  const administrator = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, displayName: true },
  });

  if (administrator?.role !== "ADMIN") redirect("/account");

  const overview = await getAdminOverview();
  const { totals } = overview;

  return (
    <main className="min-h-screen bg-[#080b13] px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/" className="text-sm text-cyan-300 hover:text-cyan-200">
          ← Viewers Tube home
        </Link>

        <header className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
              Protected administrator area
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Welcome, {administrator.displayName}. This dashboard is read-only.
            </p>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">
            ADMIN
          </span>
        </header>

        <section className="mt-6">
          <Link href="/admin/creators" className="inline-flex rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950">
            Review Creator applications
          </Link>
        </section>

        <section className="mt-5">
          <Link href="/repair-centre" className="inline-flex rounded-lg border border-cyan-300/30 px-4 py-3 font-semibold text-cyan-200 hover:bg-cyan-300/10">
            Open Repair Centre
          </Link>
        </section>

        <section className="mt-9">
          <h2 className="mb-4 text-lg font-semibold">Platform overview</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total accounts" value={totals.totalUsers} />
            <StatCard label="Viewers" value={totals.viewers} />
            <StatCard label="Creators" value={totals.creators} />
            <StatCard label="Administrators" value={totals.admins} />
            <StatCard label="Viewers Tube videos" value={totals.totalVideos} />
            <StatCard label="Ready videos" value={totals.readyVideos} />
            <StatCard label="Removed videos" value={totals.removedVideos} />
            <StatCard label="External video records" value={totals.externalVideos} />
            <StatCard label="Active Creator strikes" value={totals.activeStrikes} />
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-semibold">Recently registered accounts</h2>
              <p className="mt-1 text-xs text-slate-400">Latest 8 accounts</p>
            </div>
            <div className="divide-y divide-white/10">
              {overview.recentUsers.length === 0 ? (
                <p className="p-5 text-sm text-slate-400">No accounts found.</p>
              ) : overview.recentUsers.map((user) => (
                <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.displayName}</p>
                    <p className="break-all text-xs text-slate-400">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {user.createdAt.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-slate-300">
                      {user.role}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      {user.emailVerified ? "Verified" : "Unverified"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-semibold">Recently added videos</h2>
              <p className="mt-1 text-xs text-slate-400">Latest 8 Viewers Tube videos</p>
            </div>
            <div className="divide-y divide-white/10">
              {overview.recentVideos.length === 0 ? (
                <p className="p-5 text-sm text-slate-400">No platform videos found.</p>
              ) : overview.recentVideos.map((video) => (
                <div key={video.id} className="px-5 py-4">
                  <p className="font-medium">{video.title}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Channel: {video.channel.name} · Owner: {video.channel.owner.displayName}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-white/10 px-2.5 py-1">{video.status}</span>
                    <span className="rounded-full bg-white/10 px-2.5 py-1">{video.visibility}</span>
                    <span className="py-1 text-slate-500">{video.createdAt.toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <p className="mt-8 text-xs text-slate-500">
          Read-only overview · Account and video changes are not available here.
        </p>
      </div>
    </main>
  );
}
