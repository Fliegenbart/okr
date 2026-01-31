"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/db";
import { generateInviteCode } from "@/lib/invite";
import { action } from "@/lib/safe-action";
import {
  createCoupleSchema,
  joinCoupleSchema,
  updateCoupleSchema,
} from "@/lib/validations/couple";
import { requireUserWithCouple } from "@/actions/utils";

async function requireUserId() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Bitte melde dich an.");
  }

  return userId;
}

export const createCouple = action
  .schema(createCoupleSchema)
  .action(async ({ parsedInput }) => {
    const userId = await requireUserId();

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { coupleId: true },
    });

    if (existingUser?.coupleId) {
      throw new Error("Du bist bereits in einem Couple.");
    }

    let couple = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const inviteCode = generateInviteCode();

      try {
        couple = await prisma.couple.create({
          data: {
            name: parsedInput.name,
            vision: parsedInput.vision ?? null,
            inviteCode,
            users: {
              connect: { id: userId },
            },
          },
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
      throw new Error("Bitte versuche es erneut.");
    }

    revalidatePath("/dashboard");

    return {
      inviteCode: couple.inviteCode,
    };
  });

export const joinCouple = action
  .schema(joinCoupleSchema)
  .action(async ({ parsedInput }) => {
    const userId = await requireUserId();

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { coupleId: true },
    });

    if (existingUser?.coupleId) {
      throw new Error("Du bist bereits in einem Couple.");
    }

    const couple = await prisma.couple.findUnique({
      where: { inviteCode: parsedInput.inviteCode },
    });

    if (!couple) {
      throw new Error("Kein Couple mit diesem Code gefunden.");
    }

    const memberCount = await prisma.user.count({
      where: { coupleId: couple.id },
    });

    if (memberCount >= 2) {
      throw new Error("Dieses Couple ist bereits voll.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { coupleId: couple.id },
    });

    revalidatePath("/dashboard");

    return {
      coupleName: couple.name,
    };
  });

export const updateCouple = action
  .schema(updateCoupleSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    await prisma.couple.update({
      where: { id: user.coupleId },
      data: {
        name: parsedInput.name,
        vision: parsedInput.vision ?? null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");

    return { success: true };
  });

export const regenerateInviteCode = action.action(async () => {
  const user = await requireUserWithCouple();

  let inviteCode = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = generateInviteCode();
    try {
      const updated = await prisma.couple.update({
        where: { id: user.coupleId },
        data: { inviteCode: candidate },
        select: { inviteCode: true },
      });
      inviteCode = updated.inviteCode;
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

  if (!inviteCode) {
    throw new Error("Bitte versuche es erneut.");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/settings");

  return { inviteCode };
});
