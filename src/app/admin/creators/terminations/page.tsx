import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import TerminationAdminPanel from "./termination-admin-panel";

export default async function CreatorTerminationsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const { prisma } = await import("@/lib/prisma");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (user?.role !== "ADMIN") redirect("/");

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-5 py-10 text-white">
      <a href="/admin/creators" className="text-sm text-white/65 hover:text-white">← Creator applications</a>
      <div>
        <h1 className="text-3xl font-bold">Creator termination & appeals</h1>
        <p className="mt-2 text-sm text-white/60">Review serious violations and Creator appeals.</p>
      </div>
      <TerminationAdminPanel />
    </main>
  );
}
