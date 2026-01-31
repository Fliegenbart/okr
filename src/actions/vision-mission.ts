"use server";

import { revalidatePath } from "next/cache";

import { requireUserWithCouple } from "@/actions/utils";
import { prisma } from "@/lib/db";
import { action } from "@/lib/safe-action";
import { visionMissionSchema } from "@/lib/validations/vision-mission";

export const upsertVisionMission = action
  .schema(visionMissionSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    await prisma.couple.update({
      where: { id: user.coupleId },
      data: {
        vision: parsedInput.vision ?? null,
        mission: parsedInput.mission ?? null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard/vision-mission");

    return { success: true };
  });
