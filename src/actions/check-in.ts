"use server";

import { revalidatePath } from "next/cache";

import { requireUserWithCouple } from "@/actions/utils";
import { prisma } from "@/lib/db";
import { action } from "@/lib/safe-action";
import { checkInScheduleSchema } from "@/lib/validations/check-in";

export const updateCheckInSchedule = action
  .schema(checkInScheduleSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    await prisma.couple.update({
      where: { id: user.coupleId },
      data: parsedInput.enabled
        ? {
            checkInWeekday: parsedInput.weekday ?? null,
            checkInTime: parsedInput.time ?? null,
            checkInDurationMinutes: parsedInput.durationMinutes ?? null,
            checkInTimeZone: parsedInput.timeZone ?? null,
          }
        : {
            checkInWeekday: null,
            checkInTime: null,
            checkInDurationMinutes: null,
            checkInTimeZone: null,
          },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");

    return { success: true };
  });
