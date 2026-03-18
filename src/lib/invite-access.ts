import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/monitoring";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function claimInviteForEmail({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const now = new Date();

  const invite = await prisma.invite.findUnique({
    where: { token },
    select: {
      id: true,
      coupleId: true,
      email: true,
      expiresAt: true,
      revokedAt: true,
      acceptedAt: true,
    },
  });

  if (!invite) {
    throw new Error("Einladung nicht gefunden.");
  }

  if (invite.revokedAt) {
    throw new Error("Diese Einladung wurde widerrufen.");
  }

  if (invite.expiresAt < now) {
    throw new Error("Diese Einladung ist abgelaufen.");
  }

  if (invite.email.trim().toLowerCase() !== normalizedEmail) {
    logEvent("warn", "invite_login_email_mismatch", {
      inviteEmail: invite.email.trim().toLowerCase(),
      signedInEmail: normalizedEmail,
    });
    throw new Error(
      "Diese Einladung gehört zu einer anderen E-Mail-Adresse."
    );
  }

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: {
      email: normalizedEmail,
      emailVerified: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      coupleId: true,
    },
  });

  if (user.coupleId && user.coupleId !== invite.coupleId) {
    throw new Error("Du bist bereits in einem anderen Couple.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { coupleId: invite.coupleId },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: invite.acceptedAt ?? new Date() },
    }),
  ]);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    coupleId: invite.coupleId,
  };
}

