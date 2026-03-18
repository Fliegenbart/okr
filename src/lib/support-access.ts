import crypto from "crypto";

import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin-access";
import { canEmailSignIn, hasBetaAccess, markBetaAccessActivated } from "@/lib/beta-access";
import { logEvent } from "@/lib/monitoring";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function splitEmails(raw: string) {
  return raw
    .split(/[\n,]+/)
    .map((email) => normalizeEmail(email))
    .filter(Boolean);
}

export function isSupportAccessConfigured() {
  return Boolean(process.env.SUPPORT_ACCESS_CODE?.trim());
}

function getSupportAccessCode() {
  return process.env.SUPPORT_ACCESS_CODE?.trim() ?? "";
}

function getSupportAccessEmails() {
  return splitEmails(process.env.SUPPORT_ACCESS_EMAILS ?? "");
}

function isSupportedSupportEmail(email: string) {
  const normalized = normalizeEmail(email);

  if (isAdminEmail(normalized)) {
    return true;
  }

  return getSupportAccessEmails().includes(normalized);
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export async function authorizeSupportLogin({
  email,
  accessCode,
}: {
  email: string;
  accessCode: string;
}) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !accessCode.trim()) {
    return null;
  }

  if (!isSupportAccessConfigured()) {
    return null;
  }

  if (!isSupportedSupportEmail(normalizedEmail)) {
    const betaAllowed = await hasBetaAccess(normalizedEmail);

    if (!betaAllowed) {
      return null;
    }
  }

  if (!safeCompare(accessCode.trim(), getSupportAccessCode())) {
    logEvent("warn", "support_login_denied", { email: normalizedEmail });
    return null;
  }

  const allowed = await canEmailSignIn(normalizedEmail);

  if (!allowed && !isAdminEmail(normalizedEmail)) {
    return null;
  }

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: {
      email: normalizedEmail,
      emailVerified: new Date(),
      role: isAdminEmail(normalizedEmail) ? "ADMIN" : "USER",
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      coupleId: true,
    },
  });

  if (isAdminEmail(normalizedEmail) && user.role !== "ADMIN") {
    return prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        coupleId: true,
      },
    });
  }

  if (!isAdminEmail(normalizedEmail)) {
    await markBetaAccessActivated(normalizedEmail);
  }

  return user;
}
