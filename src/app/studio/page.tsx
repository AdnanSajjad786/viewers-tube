import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isEligibleStudioUser } from "@/lib/creator-access";
import { StudioDashboard } from "./studio-dashboard";

async function StudioContent() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      role: true,
      displayName: true,
      emailVerified: true,
      creatorApplicationStatus: true,
      creatorAgreementAcceptedAt: true,
      creatorSuspendedUntil: true,
      creatorTerminatedAt: true,
    },
  });

  if (!user || !isEligibleStudioUser(user)) redirect("/account");

  return <StudioDashboard role={user.role} displayName={user.displayName} />;
}

export default function StudioPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <p className="text-slate-300">Loading Studio…</p>
      </main>
    }>
      <StudioContent />
    </Suspense>
  );
}
