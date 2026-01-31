"use server";

import { revalidatePath } from "next/cache";

import { action } from "@/lib/safe-action";
import { prisma } from "@/lib/db";
import {
  createQuarterSchema,
  setPreferredQuarterSchema,
} from "@/lib/validations/quarter";
import { getQuarterInfo } from "@/lib/quarters";
import { requireUserWithCouple } from "@/actions/utils";

export const createQuarter = action
  .schema(createQuarterSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const startsAt = parsedInput.startsAt;
    const endsAt = new Date(parsedInput.endsAt);
    endsAt.setHours(23, 59, 59, 999);

    const overlap = await prisma.quarter.findFirst({
      where: {
        coupleId: user.coupleId,
        startsAt: { lte: endsAt },
        endsAt: { gte: startsAt },
      },
      select: { id: true },
    });

    if (overlap) {
      throw new Error("Dieses Quartal ueberschneidet sich mit einem bestehenden.");
    }

    const title = parsedInput.title?.trim() || getQuarterInfo(startsAt).title;

    const quarter = await prisma.quarter.create({
      data: {
        title,
        startsAt,
        endsAt,
        coupleId: user.coupleId,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/objectives/new");
    revalidatePath("/dashboard/settings");

    return { id: quarter.id };
  });

export const setPreferredQuarter = action
  .schema(setPreferredQuarterSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const quarterId = parsedInput.quarterId?.trim() || null;

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

    await prisma.user.update({
      where: { id: user.id },
      data: { preferredQuarterId: quarterId },
    });

    revalidatePath("/dashboard");

    return { preferredQuarterId: quarterId };
  });
