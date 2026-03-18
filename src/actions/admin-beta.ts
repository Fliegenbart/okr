"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireAdminUser, writeAuditLog } from "@/lib/admin";
import { action } from "@/lib/safe-action";
import { bulkBetaAccessSchema } from "@/lib/validations/admin-beta";

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
