import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RepairCentrePanel } from "./repair-centre-panel";

export const dynamic = "force-dynamic";

export default async function RepairCentrePage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (!user || !["ADMIN", "CREATOR"].includes(user.role)) {
    redirect("/account");
  }

  return <RepairCentrePanel role={user.role} />;
}
