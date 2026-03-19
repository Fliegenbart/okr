"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_PREVIEW_COUPLE_COOKIE,
  getAdminPreviewCookieOptions,
  sanitizeInternalPath,
} from "@/lib/active-couple";
import { prisma } from "@/lib/db";
import { requireAdminUser, writeAuditLog } from "@/lib/admin";

export async function revokeInvite(inviteId: string, _formData: FormData) {
  void _formData;

  const admin = await requireAdminUser();

  const invite = await prisma.invite.findUnique({
    where: { id: inviteId },
    select: {
      id: true,
      email: true,
      acceptedAt: true,
      revokedAt: true,
      coupleId: true,
    },
  });

  if (!invite) {
    throw new Error("Einladung nicht gefunden.");
  }

  if (invite.acceptedAt) {
    throw new Error("Diese Einladung wurde bereits angenommen.");
  }

  if (invite.revokedAt) {
    return;
  }

  const revokedAt = new Date();

  await prisma.invite.update({
    where: { id: invite.id },
    data: { revokedAt },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "invite_revoked",
    targetType: "Invite",
    targetId: invite.id,
    metadata: {
      email: invite.email,
      coupleId: invite.coupleId,
      revokedAt: revokedAt.toISOString(),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/invites");
}

export async function startAdminCouplePreview(coupleId: string, formData: FormData) {
  const admin = await requireAdminUser();
  const redirectTo = sanitizeInternalPath(formData.get("redirectTo")?.toString(), "/dashboard");

  const couple = await prisma.couple.findUnique({
    where: { id: coupleId },
    select: { id: true, name: true },
  });

  if (!couple) {
    throw new Error("Couple nicht gefunden.");
  }

  const cookieStore = await cookies();
  cookieStore.set(
    ADMIN_PREVIEW_COUPLE_COOKIE,
    couple.id,
    getAdminPreviewCookieOptions()
  );

  await writeAuditLog({
    actorId: admin.id,
    action: "admin_couple_preview_started",
    targetType: "Couple",
    targetId: couple.id,
    metadata: {
      coupleName: couple.name,
      redirectTo,
    },
  });

  redirect(redirectTo);
}

export async function stopAdminCouplePreview(formData: FormData) {
  const admin = await requireAdminUser();
  const redirectTo = sanitizeInternalPath(
    formData.get("redirectTo")?.toString(),
    "/admin/couples"
  );
  const cookieStore = await cookies();
  const previewCoupleId = cookieStore.get(ADMIN_PREVIEW_COUPLE_COOKIE)?.value ?? null;

  cookieStore.set(ADMIN_PREVIEW_COUPLE_COOKIE, "", getAdminPreviewCookieOptions(0));

  if (previewCoupleId) {
    await writeAuditLog({
      actorId: admin.id,
      action: "admin_couple_preview_stopped",
      targetType: "Couple",
      targetId: previewCoupleId,
      metadata: {
        redirectTo,
      },
    });
  }

  redirect(redirectTo);
}
