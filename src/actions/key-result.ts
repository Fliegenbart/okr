"use server";

import { revalidatePath } from "next/cache";

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/db";
import { action } from "@/lib/safe-action";
import { updateKeyResultSchema } from "@/lib/validations/key-result";
import {
  createKeyResultSchema,
  archiveKeyResultSchema,
  restoreKeyResultSchema,
  updateKeyResultMetaSchema,
} from "@/lib/validations/key-result-meta";

async function requireUser() {
  const session = await getAuthSession();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error("Bitte melde dich an.");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, coupleId: true },
  });

  if (!user?.coupleId) {
    throw new Error("Du hast noch kein Couple.");
  }

  return user as { id: string; coupleId: string };
}

export const updateKeyResult = action
  .schema(updateKeyResultSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUser();

    const keyResult = await prisma.keyResult.findFirst({
      where: {
        id: parsedInput.keyResultId,
        objective: {
          coupleId: user.coupleId,
        },
        archivedAt: null,
      },
      select: {
        id: true,
        targetValue: true,
        currentValue: true,
      },
    });

    if (!keyResult) {
      throw new Error("Key Result nicht gefunden.");
    }

    const normalizedValue = Number(parsedInput.value);

    await prisma.$transaction([
      prisma.keyResult.update({
        where: { id: keyResult.id },
        data: {
          currentValue: normalizedValue,
        },
      }),
      prisma.keyResultUpdate.create({
        data: {
          keyResultId: keyResult.id,
          previousValue: keyResult.currentValue,
          value: normalizedValue,
          note: parsedInput.note ?? null,
          updatedById: user.id,
        },
      }),
    ]);

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/key-results/${keyResult.id}`);

    return {
      currentValue: normalizedValue,
      targetValue: keyResult.targetValue,
    };
  });

export const createKeyResult = action
  .schema(createKeyResultSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUser();

    const objective = await prisma.objective.findFirst({
      where: {
        id: parsedInput.objectiveId,
        coupleId: user.coupleId,
        archivedAt: null,
      },
      select: { id: true },
    });

    if (!objective) {
      throw new Error("Objective nicht gefunden.");
    }

    const activeCount = await prisma.keyResult.count({
      where: { objectiveId: objective.id, archivedAt: null },
    });

    if (activeCount >= 6) {
      throw new Error("Maximal 6 Key Results pro Objective.");
    }

    const keyResult = await prisma.keyResult.create({
      data: {
        title: parsedInput.title,
        targetValue: parsedInput.targetValue,
        unit: parsedInput.unit ?? null,
        objectiveId: objective.id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/objectives/${objective.id}/edit`);

    return { id: keyResult.id };
  });

export const updateKeyResultMeta = action
  .schema(updateKeyResultMetaSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUser();

    const keyResult = await prisma.keyResult.findFirst({
      where: {
        id: parsedInput.keyResultId,
        objective: { coupleId: user.coupleId },
        archivedAt: null,
      },
      select: { id: true, objectiveId: true },
    });

    if (!keyResult) {
      throw new Error("Key Result nicht gefunden.");
    }

    await prisma.keyResult.update({
      where: { id: keyResult.id },
      data: {
        title: parsedInput.title,
        targetValue: parsedInput.targetValue,
        unit: parsedInput.unit ?? null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/objectives/${keyResult.objectiveId}/edit`);

    return { id: keyResult.id };
  });

export const archiveKeyResult = action
  .schema(archiveKeyResultSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUser();

    const keyResult = await prisma.keyResult.findFirst({
      where: {
        id: parsedInput.keyResultId,
        objective: { coupleId: user.coupleId },
        archivedAt: null,
      },
      select: { id: true, objectiveId: true },
    });

    if (!keyResult) {
      throw new Error("Key Result nicht gefunden.");
    }

    const activeCount = await prisma.keyResult.count({
      where: { objectiveId: keyResult.objectiveId, archivedAt: null },
    });

    if (activeCount <= 2) {
      throw new Error("Ein Objective braucht mindestens zwei Key Results.");
    }

    await prisma.keyResult.update({
      where: { id: keyResult.id },
      data: { archivedAt: new Date() },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/objectives/${keyResult.objectiveId}/edit`);

    return { archived: true };
  });

export const restoreKeyResult = action
  .schema(restoreKeyResultSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUser();

    const keyResult = await prisma.keyResult.findFirst({
      where: {
        id: parsedInput.keyResultId,
        objective: { coupleId: user.coupleId },
        archivedAt: { not: null },
      },
      select: { id: true, objectiveId: true },
    });

    if (!keyResult) {
      throw new Error("Key Result nicht gefunden.");
    }

    await prisma.keyResult.update({
      where: { id: keyResult.id },
      data: { archivedAt: null },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/objectives/${keyResult.objectiveId}/edit`);

    return { restored: true };
  });
