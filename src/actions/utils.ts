"use server";

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/db";

export async function requireUserWithCouple() {
  const session = await getAuthSession();
  const userId = session?.user?.id ?? undefined;
  const userEmail = session?.user?.email ?? undefined;

  if (!userId && !userEmail) {
    throw new Error("Bitte melde dich an.");
  }

  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email: userEmail },
    select: { id: true, coupleId: true, email: true },
  });

  if (!user) {
    throw new Error("Bitte melde dich erneut an.");
  }

  if (!user.coupleId) {
    throw new Error("Du hast noch kein Couple.");
  }

  return user as { id: string; coupleId: string; email: string | null };
}
