"use server";

import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/db";
import { getBaseUrl, isEmailConfigured, sendPartnerInviteEmail } from "@/lib/email";
import { generateInviteToken } from "@/lib/invite";
import { logEvent } from "@/lib/monitoring";
import { assertRateLimit } from "@/lib/rate-limit";
import { action } from "@/lib/safe-action";
import { acceptInviteSchema, createInviteSchema } from "@/lib/validations/invite";
import { requireUserWithCouple } from "@/actions/utils";

const INVITE_EXPIRY_DAYS = 7;

export const createInvite = action
  .schema(createInviteSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();
    const email = parsedInput.email.toLowerCase();
    const now = new Date();

    await assertRateLimit({
      action: "couple_invite_create",
      key: `${user.coupleId}:${email}`,
      limit: 4,
      windowMs: 60 * 60 * 1000,
    });

    const memberCount = await prisma.user.count({
      where: { coupleId: user.coupleId },
    });

    if (memberCount >= 2) {
      throw new Error("Euer Couple ist bereits voll.");
    }

    const existingMember = await prisma.user.findFirst({
      where: { email, coupleId: user.coupleId },
      select: { id: true },
    });

    if (existingMember) {
      throw new Error("Diese Person ist bereits im Couple.");
    }

    await prisma.invite.deleteMany({
      where: {
        coupleId: user.coupleId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { lte: now },
      },
    });

    const existingInvite = await prisma.invite.findFirst({
      where: {
        coupleId: user.coupleId,
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const invite =
      existingInvite ??
      (await prisma.invite.create({
        data: {
          coupleId: user.coupleId,
          email,
          token: generateInviteToken(),
          expiresAt: new Date(
            Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
          ),
        },
      }));

    const baseUrl = getBaseUrl();
    const inviteUrl = baseUrl ? `${baseUrl}/join?token=${invite.token}` : "";

    if (inviteUrl) {
      try {
        await sendPartnerInviteEmail(email, inviteUrl);
      } catch (error) {
        logEvent("error", "couple_invite_email_failed", {
          email,
          coupleId: user.coupleId,
          message: error instanceof Error ? error.message : "unknown",
        });
        throw new Error(
          "Die Einladungs-Mail konnte gerade nicht verschickt werden. Bitte versuche es in ein paar Minuten erneut."
        );
      }
    }

    logEvent("info", "couple_invite_created", {
      email,
      coupleId: user.coupleId,
      reused: Boolean(existingInvite),
      emailConfigured: isEmailConfigured(),
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");

    return {
      email: invite.email,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
    };
  });

export const acceptInvite = action
  .schema(acceptInviteSchema)
  .action(async ({ parsedInput }) => {
    const session = await getAuthSession();

    if (!session?.user?.id) {
      throw new Error("Bitte melde dich an.");
    }

    await assertRateLimit({
      action: "couple_invite_accept",
      key: `${session.user.id}:${parsedInput.token}`,
      limit: 6,
      windowMs: 30 * 60 * 1000,
    });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, coupleId: true, email: true },
    });

    if (!user) {
      throw new Error("Bitte melde dich an.");
    }

    if (user.coupleId) {
      throw new Error("Du bist bereits in einem Couple.");
    }

    if (!user.email) {
      throw new Error("Für den Beitritt brauchen wir eine gültige E-Mail.");
    }

    const invite = await prisma.invite.findUnique({
      where: { token: parsedInput.token },
      include: {
        couple: { select: { id: true } },
      },
    });

    if (!invite) {
      throw new Error("Einladung nicht gefunden.");
    }

    if (invite.acceptedAt) {
      throw new Error("Diese Einladung wurde bereits verwendet.");
    }

    if (invite.revokedAt) {
      throw new Error("Diese Einladung wurde widerrufen.");
    }

    if (invite.expiresAt < new Date()) {
      throw new Error("Diese Einladung ist abgelaufen.");
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      logEvent("warn", "couple_invite_email_mismatch", {
        inviteEmail: invite.email.toLowerCase(),
        signedInEmail: user.email.toLowerCase(),
      });
      throw new Error(
        "Diese Einladung gehört zu einer anderen E-Mail-Adresse. Bitte melde dich mit der eingeladenen E-Mail an."
      );
    }

    const memberCount = await prisma.user.count({
      where: { coupleId: invite.coupleId },
    });

    if (memberCount >= 2) {
      throw new Error("Dieses Couple ist bereits voll.");
    }

    await prisma.$transaction([
      prisma.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { coupleId: invite.coupleId },
      }),
    ]);

    logEvent("info", "couple_invite_accepted", {
      email: user.email.toLowerCase(),
      coupleId: invite.coupleId,
    });

    revalidatePath("/dashboard");

    return { success: true };
  });
