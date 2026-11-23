import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TerminationAppealForm from "./termination-appeal-form";

export default async function CreatorTerminationAppealPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, creatorTerminatedAt: true },
  });

  if (user?.role !== "CREATOR" || !user.creatorTerminatedAt) redirect("/account");

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-6 px-5 py-10 text-white">
      <Link href="/account" className="text-sm text-white/65 hover:text-white">← Back to Account</Link>
      <div>
        <h1 className="text-3xl font-bold">Creator termination appeal</h1>
        <p className="mt-2 text-sm text-white/60">Review the decision and submit an appeal for Admin consideration.</p>
      </div>
      <TerminationAppealForm />
    </main>
  );
}
