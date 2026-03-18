"use server";

import { revalidatePath } from "next/cache";

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
