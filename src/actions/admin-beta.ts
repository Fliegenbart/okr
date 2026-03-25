"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdminUser, writeAuditLog } from "@/lib/admin";
import { getBaseUrl } from "@/lib/email";
import { generateInviteCode, generateInviteToken } from "@/lib/invite";
import { action } from "@/lib/safe-action";
import { bulkBetaAccessSchema, createBetaCoupleSchema } from "@/lib/validations/admin-beta";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function parseBulkEntries(rawEntries: string) {
  const lines = rawEntries
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = new Map<string, string | null>();

  lines.forEach((line, index) => {
    const [emailPart, ...noteParts] = line.split("|");
    const email = normalizeEmail(emailPart ?? "");
    const note = noteParts.join("|").trim() || null;

    if (!email || !email.includes("@")) {
      throw new Error(`Ungültige E-Mail in Zeile ${index + 1}.`);
    }

    entries.set(email, note);
  });

  return Array.from(entries.entries()).map(([email, note]) => ({
    email,
    note,
  }));
}

export const upsertBetaAccessEntries = action
  .schema(bulkBetaAccessSchema)
  .action(async ({ parsedInput }) => {
    const admin = await requireAdminUser();
    const entries = parseBulkEntries(parsedInput.entries);

    if (!entries.length) {
      throw new Error("Bitte füge mindestens eine E-Mail ein.");
    }

    await prisma.$transaction(
      entries.map(({ email, note }) =>
        prisma.betaAccessInvite.upsert({
          where: { email },
          update: note ? { note } : {},
          create: {
            email,
            note,
          },
        })
      )
    );

    await writeAuditLog({
      actorId: admin.id,
      action: "beta_access_bulk_upsert",
      targetType: "BetaAccessInvite",
      targetId: null,
      metadata: {
        count: entries.length,
        emails: entries.map((entry) => entry.email),
      },
    });

    revalidatePath("/admin/beta");
    revalidatePath("/auth/signin");

    return {
      count: entries.length,
    };
  });

export const createBetaCoupleWithLinks = action
  .schema(createBetaCoupleSchema)
  .action(async ({ parsedInput }) => {
    const admin = await requireAdminUser();
    const partnerOneEmail = normalizeEmail(parsedInput.partnerOneEmail);
    const partnerTwoEmail = normalizeEmail(parsedInput.partnerTwoEmail ?? "");
    const baseUrl = getBaseUrl();

    if (partnerTwoEmail && partnerOneEmail === partnerTwoEmail) {
      throw new Error("Bitte gib für Person 2 eine andere E-Mail-Adresse an.");
    }

    if (!baseUrl) {
      throw new Error(
        "Die App-URL ist nicht gesetzt. Bitte NEXT_PUBLIC_APP_URL oder NEXTAUTH_URL konfigurieren."
      );
    }

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invites = [
      {
        email: partnerOneEmail,
        label: "Person 1",
        token: generateInviteToken(),
      },
      ...(partnerTwoEmail
        ? [
            {
              email: partnerTwoEmail,
              label: "Person 2",
              token: generateInviteToken(),
            },
          ]
        : []),
    ];

    let couple:
      | {
          id: string;
          name: string;
          inviteCode: string;
        }
      | null = null;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const inviteCode = generateInviteCode();

      try {
        couple = await prisma.$transaction(async (tx) => {
          const createdCouple = await tx.couple.create({
            data: {
              name: parsedInput.coupleName.trim(),
              inviteCode,
            },
            select: {
              id: true,
              name: true,
              inviteCode: true,
            },
          });

          await Promise.all(
            invites.map((invite) =>
              tx.invite.create({
                data: {
                  coupleId: createdCouple.id,
                  email: invite.email,
                  token: invite.token,
                  expiresAt,
                },
              })
            )
          );

          return createdCouple;
        });
        break;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        throw error;
      }
    }

    if (!couple) {
      throw new Error("Das Couple konnte gerade nicht angelegt werden. Bitte versuche es erneut.");
    }

    const inviteLinks = invites.map((invite) => ({
      label: invite.label,
      email: invite.email,
      url: `${baseUrl}/join?token=${invite.token}`,
      expiresAt: expiresAt.toISOString(),
    }));

    await writeAuditLog({
      actorId: admin.id,
      action: "beta_couple_created",
      targetType: "Couple",
      targetId: couple.id,
      metadata: {
        coupleName: couple.name,
        inviteCode: couple.inviteCode,
        inviteEmails: inviteLinks.map((invite) => invite.email),
      } as Prisma.InputJsonValue,
    });

    revalidatePath("/admin/beta");
    revalidatePath("/admin/couples");

    return {
      coupleId: couple.id,
      coupleName: couple.name,
      inviteCode: couple.inviteCode,
      inviteLinks,
    };
  });

export async function deleteBetaAccessEntry(entryId: string, _formData: FormData) {
  void _formData;

  const admin = await requireAdminUser();
  const entry = await prisma.betaAccessInvite.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      email: true,
      note: true,
      activatedAt: true,
    },
  });

  if (!entry) {
    throw new Error("Beta-Eintrag nicht gefunden.");
  }

  await prisma.betaAccessInvite.delete({
    where: { id: entry.id },
  });

  await writeAuditLog({
    actorId: admin.id,
    action: "beta_access_entry_deleted",
    targetType: "BetaAccessInvite",
    targetId: entry.id,
    metadata: {
      email: entry.email,
      note: entry.note,
      activatedAt: entry.activatedAt?.toISOString() ?? null,
    },
  });

  revalidatePath("/admin/beta");
  revalidatePath("/auth/signin");
}
