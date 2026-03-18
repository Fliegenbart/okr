"use server";

import { revalidatePath } from "next/cache";

import { requireUserWithCouple } from "@/actions/utils";
import { prisma } from "@/lib/db";
import { computeNextOccurrence, upsertReminder } from "@/lib/couple-engagement";
import { action } from "@/lib/safe-action";
import { checkInScheduleSchema } from "@/lib/validations/check-in";

export const updateCheckInSchedule = action
  .schema(checkInScheduleSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();
    const couple = await prisma.couple.findUnique({
      where: { id: user.coupleId },
      select: {
        checkInWeekday: true,
        checkInTime: true,
        name: true,
      },
    });

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

    if (!parsedInput.enabled) {
      await prisma.reminder.updateMany({
        where: {
          coupleId: user.coupleId,
          kind: "CHECK_IN",
          relatedType: "check-in-schedule",
          relatedId: user.coupleId,
          status: "PENDING",
        },
        data: {
          status: "DISMISSED",
          dismissedAt: new Date(),
          completedAt: null,
        },
      });
    } else if (couple && parsedInput.weekday && parsedInput.time) {
      await upsertReminder({
        coupleId: user.coupleId,
        kind: "CHECK_IN",
        title: `Weekly Check-in (${couple.name})`,
        body: "Euer nächster Check-in wartet im Kalender.",
        dueAt: computeNextOccurrence(parsedInput.weekday, parsedInput.time),
        relatedType: "check-in-schedule",
        relatedId: user.coupleId,
        createdById: user.id,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");

    return { success: true };
  });
