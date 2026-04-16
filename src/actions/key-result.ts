"use server";

import { revalidatePath } from "next/cache";

import { requireUserWithCouple } from "@/actions/utils";
import { prisma } from "@/lib/db";
import { getBinaryValue } from "@/lib/key-results";
import { action } from "@/lib/safe-action";
import { updateKeyResultSchema } from "@/lib/validations/key-result";
import {
  createKeyResultSchema,
  archiveKeyResultSchema,
  restoreKeyResultSchema,
  updateKeyResultMetaSchema,
} from "@/lib/validations/key-result-meta";

export const updateKeyResult = action
  .schema(updateKeyResultSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

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
        type: true,
      },
    });

    if (!keyResult) {
      throw new Error("Key Result nicht gefunden.");
    }

    const normalizedValue =
      keyResult.type === "BINARY"
        ? getBinaryValue(parsedInput.achieved ? 1 : 0)
        : Number(parsedInput.value);

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
      type: keyResult.type,
    };
  });

export const createKeyResult = action
  .schema(createKeyResultSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

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

    if (activeCount >= 5) {
      throw new Error("Maximal 5 Key Results pro Objective.");
    }

    const keyResult = await prisma.keyResult.create({
      data: {
        title: parsedInput.title,
        type: parsedInput.type,
        direction: parsedInput.direction,
        targetValue: parsedInput.type === "BINARY" ? 1 : parsedInput.targetValue,
        startValue: parsedInput.type === "BINARY" ? 0 : parsedInput.startValue,
        currentValue:
          parsedInput.type === "BINARY"
            ? 0
            : parsedInput.startValue,
        redThreshold: parsedInput.type === "TRAFFIC_LIGHT" ? parsedInput.redThreshold : null,
        yellowThreshold:
          parsedInput.type === "TRAFFIC_LIGHT" ? parsedInput.yellowThreshold : null,
        greenThreshold:
          parsedInput.type === "TRAFFIC_LIGHT" ? parsedInput.greenThreshold : null,
        unit: parsedInput.unit ?? null,
        description: parsedInput.description ?? null,
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
    const user = await requireUserWithCouple();

    const keyResult = await prisma.keyResult.findFirst({
      where: {
        id: parsedInput.keyResultId,
        objective: { coupleId: user.coupleId },
        archivedAt: null,
      },
      select: {
        id: true,
        objectiveId: true,
        currentValue: true,
        startValue: true,
        type: true,
        direction: true,
        targetValue: true,
        unit: true,
        description: true,
        redThreshold: true,
        yellowThreshold: true,
        greenThreshold: true,
        updates: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!keyResult) {
      throw new Error("Key Result nicht gefunden.");
    }

    const nextType = parsedInput.type ?? keyResult.type;
    const nextTargetValue =
      nextType === "BINARY" ? 1 : parsedInput.targetValue ?? keyResult.targetValue;
    const nextStartValue =
      nextType === "BINARY" ? 0 : parsedInput.startValue ?? keyResult.startValue;
    const nextDirection = parsedInput.direction ?? keyResult.direction;
    const nextRedThreshold =
      nextType === "TRAFFIC_LIGHT"
        ? parsedInput.redThreshold ?? keyResult.redThreshold
        : null;
    const nextYellowThreshold =
      nextType === "TRAFFIC_LIGHT"
        ? parsedInput.yellowThreshold ?? keyResult.yellowThreshold
        : null;
    const nextGreenThreshold =
      nextType === "TRAFFIC_LIGHT"
        ? parsedInput.greenThreshold ?? keyResult.greenThreshold
        : null;

    if (
      nextType === "TRAFFIC_LIGHT" &&
      (nextRedThreshold === null ||
        nextYellowThreshold === null ||
        nextGreenThreshold === null)
    ) {
      throw new Error("Bitte gib für die Ampel rot, gelb und grün an.");
    }

    if (nextType === "TRAFFIC_LIGHT") {
      const orderIsValid =
        nextDirection === "LOWER_IS_BETTER"
          ? nextGreenThreshold! <= nextYellowThreshold! &&
            nextYellowThreshold! <= nextRedThreshold!
          : nextRedThreshold! <= nextYellowThreshold! &&
            nextYellowThreshold! <= nextGreenThreshold!;

      if (!orderIsValid) {
        throw new Error(
          nextDirection === "LOWER_IS_BETTER"
            ? "Bei 'weniger ist besser' muss grün <= gelb <= rot sein."
            : "Bei 'mehr ist besser' muss rot <= gelb <= grün sein."
        );
      }
    }

    await prisma.keyResult.update({
      where: { id: keyResult.id },
      data: {
        title: parsedInput.title,
        type: nextType,
        direction: nextDirection,
        targetValue: nextTargetValue,
        startValue: nextStartValue,
        currentValue:
          nextType === "BINARY"
            ? getBinaryValue(keyResult.currentValue)
            : keyResult.updates.length === 0 || keyResult.currentValue === keyResult.startValue
              ? nextStartValue
              : undefined,
        redThreshold: nextRedThreshold,
        yellowThreshold: nextYellowThreshold,
        greenThreshold: nextGreenThreshold,
        unit: parsedInput.unit ?? keyResult.unit,
        description: parsedInput.description ?? keyResult.description,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/objectives/${keyResult.objectiveId}/edit`);

    return { id: keyResult.id };
  });

export const archiveKeyResult = action
  .schema(archiveKeyResultSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

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

    if (activeCount <= 1) {
      throw new Error("Ein Objective braucht mindestens ein Key Result.");
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
    const user = await requireUserWithCouple();

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

    const activeCount = await prisma.keyResult.count({
      where: {
        objectiveId: keyResult.objectiveId,
        archivedAt: null,
      },
    });

    if (activeCount >= 5) {
      throw new Error("Maximal 5 Key Results pro Objective.");
    }

    await prisma.keyResult.update({
      where: { id: keyResult.id },
      data: { archivedAt: null },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/objectives/${keyResult.objectiveId}/edit`);

    return { restored: true };
  });
