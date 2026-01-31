"use server";

import nodemailer from "nodemailer";
import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/db";
import { generateInviteToken } from "@/lib/invite";
import { action } from "@/lib/safe-action";
import { acceptInviteSchema, createInviteSchema } from "@/lib/validations/invite";
import { requireUserWithCouple } from "@/actions/utils";

const INVITE_EXPIRY_DAYS = 7;

function getBaseUrl() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "";
  return base.replace(/\/$/, "");
}

function isEmailConfigured() {
  const host = process.env.EMAIL_SERVER_HOST;
  if (!host || host === "smtp.example.com") return false;
  return Boolean(
    process.env.EMAIL_FROM &&
      process.env.EMAIL_SERVER_USER &&
      process.env.EMAIL_SERVER_PASSWORD
  );
}

async function sendInviteEmail(to: string, inviteUrl: string) {
  if (!isEmailConfigured()) return;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_SERVER_HOST,
    port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
    auth: {
      user: process.env.EMAIL_SERVER_USER,
      pass: process.env.EMAIL_SERVER_PASSWORD,
    },
  });

  const subject = "Einladung: OKR fuer Paare";
  const text = `Du wurdest eingeladen, einem Couple beizutreten. \n\nHier ist dein Link: ${inviteUrl}`;
  const html = `<p>Du wurdest eingeladen, einem Couple beizutreten.</p><p><a href="${inviteUrl}">Zum Couple beitreten</a></p>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}

export const createInvite = action
  .schema(createInviteSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();
    const email = parsedInput.email.toLowerCase();

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
      where: { coupleId: user.coupleId, email, acceptedAt: null },
    });

    const token = generateInviteToken();
    const expiresAt = new Date(
      Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    const invite = await prisma.invite.create({
      data: {
        coupleId: user.coupleId,
        email,
        token,
        expiresAt,
      },
    });

    const baseUrl = getBaseUrl();
    const inviteUrl = baseUrl ? `${baseUrl}/join?token=${token}` : "";

    if (inviteUrl) {
      await sendInviteEmail(email, inviteUrl);
    }

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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, coupleId: true },
    });

    if (!user) {
      throw new Error("Bitte melde dich an.");
    }

    if (user.coupleId) {
      throw new Error("Du bist bereits in einem Couple.");
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

    if (invite.expiresAt < new Date()) {
      throw new Error("Diese Einladung ist abgelaufen.");
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

    revalidatePath("/dashboard");

    return { success: true };
  });
