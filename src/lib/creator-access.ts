import { prisma } from "@/lib/prisma";
type StudioAccessUser = {
  role: string;
  emailVerified: boolean;
  creatorApplicationStatus: string;
  creatorAgreementAcceptedAt: Date | null;
  creatorSuspendedUntil: Date | null;
  creatorTerminatedAt: Date | null;
};

export function isEligibleStudioUser(user: StudioAccessUser): boolean {
  if (user.role === "ADMIN") return true;

  if (user.role !== "CREATOR") return false;

  return (
    user.emailVerified &&
    user.creatorApplicationStatus === "APPROVED" &&
    !!user.creatorAgreementAcceptedAt &&
    !user.creatorTerminatedAt &&
    (!user.creatorSuspendedUntil ||
      user.creatorSuspendedUntil <= new Date())
  );
}


export async function isEligibleStudioUserById(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      emailVerified: true,
      creatorApplicationStatus: true,
      creatorAgreementAcceptedAt: true,
      creatorSuspendedUntil: true,
      creatorTerminatedAt: true,
    },
  });

  return !!user && isEligibleStudioUser(user);
}
