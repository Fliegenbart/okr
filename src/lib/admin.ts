import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/monitoring";
import { isAdminEmail } from "@/lib/admin-access";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() ?? "";
}

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "USER" | "ADMIN";
  coupleId: string | null;
};

export async function getAdminUser() {
  const session = await getAuthSession();
  const sessionUserId = session?.user?.id ?? "";
  const sessionUserEmail = normalizeEmail(session?.user?.email ?? "");

  if (!sessionUserId && !sessionUserEmail) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: sessionUserId
      ? { id: sessionUserId }
      : { email: sessionUserEmail },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      coupleId: true,
    },
  });

  if (!user) {
    return null;
  }

  const shouldPromote = isAdminEmail(user.email);

  if (shouldPromote && user.role !== "ADMIN") {
    const promoted = await prisma.user.update({
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

    logEvent("info", "admin_role_promoted", {
      userId: promoted.id,
      email: promoted.email,
    });

    return promoted;
  }

  return user;
}

export async function requireAdminUser() {
  const user = await getAdminUser();

  if (!user) {
    redirect("/auth/signin?callbackUrl=/admin");
  }

  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  return user;
}

export async function writeAuditLog({
  actorId,
  action,
  targetType,
  targetId,
  metadata,
}: {
  actorId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: actorId ?? null,
      action,
      targetType,
      targetId: targetId ?? null,
      metadata: metadata ?? Prisma.DbNull,
    },
  });
}
