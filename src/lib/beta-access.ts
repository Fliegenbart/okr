import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin-access";
import { isClosedBetaMode, isSelfServeSignupAllowed } from "@/lib/runtime-flags";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function hasBetaAccess(email: string) {
  const normalizedEmail = normalizeEmail(email);

  const invite = await prisma.betaAccessInvite.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      activatedAt: true,
    },
  });

  return Boolean(invite);
}

export async function canEmailCreateCouple(email: string) {
  if (isAdminEmail(email)) {
    return true;
  }

  if (!isClosedBetaMode() || isSelfServeSignupAllowed()) {
    return true;
  }

  return hasBetaAccess(email);
}

export async function canEmailSignIn(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (isAdminEmail(normalizedEmail)) {
    return true;
  }

  if (!isClosedBetaMode()) {
    return true;
  }

  const [existingUser, pendingInvite, betaAccess] = await Promise.all([
    prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    }),
    prisma.invite.findFirst({
      where: {
        email: normalizedEmail,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: { id: true },
    }),
    prisma.betaAccessInvite.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    }),
  ]);

  if (existingUser || pendingInvite || betaAccess) {
    return true;
  }

  return isSelfServeSignupAllowed();
}

export async function markBetaAccessActivated(email: string) {
  const normalizedEmail = normalizeEmail(email);

  await prisma.betaAccessInvite.updateMany({
    where: {
      email: normalizedEmail,
      activatedAt: null,
    },
    data: {
      activatedAt: new Date(),
    },
  });
}
