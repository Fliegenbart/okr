"use server";

import { revalidatePath } from "next/cache";

import { action } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import {
  createObjectiveSchema,
  archiveObjectiveSchema,
  restoreObjectiveSchema,
  updateObjectiveSchema,
  setObjectiveNextActionSchema,
} from "@/lib/validations/objective";
import { getQuarterInfo } from "@/lib/quarters";
import { requireUserWithCouple } from "@/actions/utils";

export const createObjective = action
  .schema(createObjectiveSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();
    const now = new Date();

    let quarterId = parsedInput.quarterId?.trim() || null;

    if (quarterId) {
      const quarter = await prisma.quarter.findFirst({
        where: {
          id: quarterId,
          coupleId: user.coupleId,
        },
        select: { id: true },
      });

      if (!quarter) {
        throw new Error("Quartal nicht gefunden.");
      }
    }

    if (!quarterId) {
      const activeQuarter = await prisma.quarter.findFirst({
        where: {
          coupleId: user.coupleId,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
        orderBy: { startsAt: "desc" },
      });

      if (activeQuarter) {
        quarterId = activeQuarter.id;
      }
    }

    if (!quarterId) {
      const fallbackQuarter = await prisma.quarter.findFirst({
        where: { coupleId: user.coupleId },
        orderBy: { endsAt: "desc" },
      });

      if (fallbackQuarter) {
        quarterId = fallbackQuarter.id;
      }
    }

    if (!quarterId) {
      const { title, startsAt, endsAt } = getQuarterInfo(now);
      const createdQuarter = await prisma.quarter.create({
        data: {
          title,
          startsAt,
          endsAt,
          coupleId: user.coupleId,
        },
      });
      quarterId = createdQuarter.id;
    }

    const keyResults = parsedInput.keyResults.filter((keyResult) =>
      keyResult.title.trim()
    );

    if (keyResults.length < 2) {
      throw new Error("Bitte gib mindestens zwei Key Results an.");
    }

    if (keyResults.length > 6) {
      throw new Error("Maximal 6 Key Results pro Objective.");
    }

    const objectiveCount = await prisma.objective.count({
      where: {
        coupleId: user.coupleId,
        quarterId,
        archivedAt: null,
      },
    });

    if (objectiveCount >= 5) {
      throw new Error("Maximal 5 Objectives pro Quartal.");
    }

    const objective = await prisma.objective.create({
      data: {
        title: parsedInput.title,
        description: parsedInput.description ?? null,
        coupleId: user.coupleId,
        quarterId,
        keyResults: {
          create: keyResults.map((keyResult) => ({
            title: keyResult.title,
            targetValue: keyResult.targetValue,
            unit: keyResult.unit ?? null,
          })),
        },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/objectives/new");

    return { id: objective.id };
  });

export const updateObjective = action
  .schema(updateObjectiveSchema)
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

    if (parsedInput.quarterId) {
      const quarter = await prisma.quarter.findFirst({
        where: {
          id: parsedInput.quarterId,
          coupleId: user.coupleId,
        },
        select: { id: true },
      });

      if (!quarter) {
        throw new Error("Quartal nicht gefunden.");
      }

      const objectiveCount = await prisma.objective.count({
        where: {
          coupleId: user.coupleId,
          quarterId: parsedInput.quarterId,
          archivedAt: null,
          NOT: { id: objective.id },
        },
      });

      if (objectiveCount >= 5) {
        throw new Error("Maximal 5 Objectives pro Quartal.");
      }
    }

    await prisma.objective.update({
      where: { id: objective.id },
      data: {
        title: parsedInput.title,
        description: parsedInput.description ?? null,
        quarterId: parsedInput.quarterId ?? undefined,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/objectives/${objective.id}/edit`);

    return { id: objective.id };
  });

export const archiveObjective = action
  .schema(archiveObjectiveSchema)
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

    await prisma.objective.update({
      where: { id: objective.id },
      data: { archivedAt: new Date() },
    });

    revalidatePath("/dashboard");

    return { archived: true };
  });

export const restoreObjective = action
  .schema(restoreObjectiveSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const objective = await prisma.objective.findFirst({
      where: {
        id: parsedInput.objectiveId,
        coupleId: user.coupleId,
        archivedAt: { not: null },
      },
      select: { id: true },
    });

    if (!objective) {
      throw new Error("Objective nicht gefunden.");
    }

    await prisma.objective.update({
      where: { id: objective.id },
      data: { archivedAt: null },
    });

    revalidatePath("/dashboard");

    return { restored: true };
  });

export const setObjectiveNextAction = action
  .schema(setObjectiveNextActionSchema)
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

    const ownerId = parsedInput.ownerId?.trim() || null;

    if (ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: ownerId, coupleId: user.coupleId },
        select: { id: true },
      });

      if (!owner) {
        throw new Error("Owner nicht gefunden.");
      }
    }

    await prisma.objective.update({
      where: { id: objective.id },
      data: {
        nextAction: parsedInput.nextAction,
        nextActionOwnerId: ownerId,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/objectives/${objective.id}`);

    return { saved: true };
  });
