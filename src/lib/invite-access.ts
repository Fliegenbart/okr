import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/monitoring";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function loadInviteByToken(token: string) {
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

  if (invite.expiresAt < new Date()) {
    throw new Error("Diese Einladung ist abgelaufen.");
  }

  if (invite.acceptedAt) {
    throw new Error("Diese Einladung wurde bereits verwendet.");
  }

  return invite;
}

async function assignInviteToUser(invite: {
  id: string;
  coupleId: string;
  email: string;
}) {
  const normalizedEmail = normalizeEmail(invite.email);

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

  const memberCount = await prisma.user.count({
    where: { coupleId: invite.coupleId },
  });

  if (!user.coupleId && memberCount >= 2) {
    throw new Error("Dieses Couple ist bereits voll.");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { coupleId: invite.coupleId },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
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

export async function claimInviteForEmail({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const normalizedEmail = normalizeEmail(email);
  const invite = await loadInviteByToken(token);

  if (invite.email.trim().toLowerCase() !== normalizedEmail) {
    logEvent("warn", "invite_login_email_mismatch", {
      inviteEmail: invite.email.trim().toLowerCase(),
      signedInEmail: normalizedEmail,
    });
    throw new Error(
      "Diese Einladung gehört zu einer anderen E-Mail-Adresse."
    );
  }

  return assignInviteToUser(invite);
}

export async function claimInviteByToken(token: string) {
  const invite = await loadInviteByToken(token);

  logEvent("info", "invite_login_token_claimed", {
    inviteId: invite.id,
    coupleId: invite.coupleId,
  });

  return assignInviteToUser(invite);
}
