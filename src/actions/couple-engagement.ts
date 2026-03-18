"use server";

import { revalidatePath } from "next/cache";

import { requireUserWithCouple } from "@/actions/utils";
import { prisma } from "@/lib/db";
import { logEvent } from "@/lib/monitoring";
import { action } from "@/lib/safe-action";
import {
  createCheckInSessionSchema,
  createCommitmentSchema,
  createTimelineNoteSchema,
  updateCommitmentStatusSchema,
  updateReminderStatusSchema,
} from "@/lib/validations/couple-engagement";
import {
  computeNextOccurrence,
  createTimelineEvent,
  getQuarterReviewDueAt,
  normalizeChecklistItems,
  setReminderStatus,
  upsertReminder,
} from "@/lib/couple-engagement";

async function resolveActiveQuarter(coupleId: string) {
  const now = new Date();
  return prisma.quarter.findFirst({
    where: {
      coupleId,
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { startsAt: "desc" },
  });
}

async function ensureQuarterReminder(input: {
  coupleId: string;
  quarterId: string;
  quarterTitle: string;
  quarterEndsAt: Date;
  createdById: string;
}) {
  const dueAt = getQuarterReviewDueAt(input.quarterEndsAt);

  await upsertReminder({
    coupleId: input.coupleId,
    kind: "QUARTER_REVIEW",
    title: `Quarter-Review: ${input.quarterTitle}`,
    body: "Zeit, das Quartal gemeinsam zu reviewen und das nächste zu schärfen.",
    dueAt,
    relatedType: "quarter",
    relatedId: input.quarterId,
    createdById: input.createdById,
    quarterId: input.quarterId,
  });
}

async function ensureCheckInReminder(input: {
  coupleId: string;
  createdById: string;
  checkInSessionId?: string | null;
  quarterId?: string | null;
  title: string;
  checkInWeekday?: number | null;
  checkInTime?: string | null;
}) {
  const dueAt =
    input.checkInWeekday && input.checkInTime
      ? computeNextOccurrence(input.checkInWeekday, input.checkInTime)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await upsertReminder({
    coupleId: input.coupleId,
    kind: "CHECK_IN",
    title: input.title,
    body: "Euer nächster Check-in ist fällig.",
    dueAt,
    relatedType: "check-in-schedule",
    relatedId: input.coupleId,
    createdById: input.createdById,
    quarterId: input.quarterId ?? null,
    checkInSessionId: input.checkInSessionId ?? null,
  });
}

async function syncCommitmentReminder(input: {
  coupleId: string;
  commitmentId: string;
  title: string;
  dueAt: Date;
  createdById: string;
}) {
  await upsertReminder({
    coupleId: input.coupleId,
    kind: "COMMITMENT",
    title: input.title,
    body: "Dieses Commitment hat ein Fälligkeitsdatum.",
    dueAt: input.dueAt,
    relatedType: "commitment",
    relatedId: input.commitmentId,
    createdById: input.createdById,
    commitmentId: input.commitmentId,
  });
}

export const createCheckInSession = action
  .schema(createCheckInSessionSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();
    const couple = await prisma.couple.findUnique({
      where: { id: user.coupleId },
      select: {
        id: true,
        name: true,
        checkInWeekday: true,
        checkInTime: true,
      },
    });

    const quarter =
      parsedInput.quarterId?.trim()
        ? await prisma.quarter.findFirst({
            where: {
              id: parsedInput.quarterId,
              coupleId: user.coupleId,
            },
          })
        : await resolveActiveQuarter(user.coupleId);

    if (parsedInput.quarterId?.trim() && !quarter) {
      throw new Error("Quartal nicht gefunden.");
    }

    const session = await prisma.checkInSession.create({
      data: {
        coupleId: user.coupleId,
        quarterId: quarter?.id ?? null,
        templateKey: parsedInput.templateKey ?? null,
        title: parsedInput.title,
        moodRating: parsedInput.moodRating ?? null,
        highlights: parsedInput.highlights ?? null,
        tensions: parsedInput.tensions ?? null,
        summary: parsedInput.summary ?? null,
        nextSteps: parsedInput.nextSteps ?? null,
        createdById: user.id,
      },
    });

    const nextStepItems = normalizeChecklistItems(parsedInput.nextSteps);

    const createdCommitments = await Promise.all(
      nextStepItems.map((item) =>
        prisma.commitment.create({
          data: {
            coupleId: user.coupleId,
            checkInSessionId: session.id,
            title: item,
            source: "CHECK_IN",
            createdById: user.id,
          },
        })
      )
    );

    if (quarter) {
      await ensureQuarterReminder({
        coupleId: user.coupleId,
        quarterId: quarter.id,
        quarterTitle: quarter.title,
        quarterEndsAt: quarter.endsAt,
        createdById: user.id,
      });
    }

    await ensureCheckInReminder({
      coupleId: user.coupleId,
      createdById: user.id,
      checkInSessionId: session.id,
      quarterId: quarter?.id ?? null,
      title: `Nächster Check-in: ${session.title}`,
      checkInWeekday: couple?.checkInWeekday ?? null,
      checkInTime: couple?.checkInTime ?? null,
    });

    await createTimelineEvent({
      coupleId: user.coupleId,
      kind: "CHECK_IN",
      title: session.title,
      summary:
        parsedInput.summary ??
        parsedInput.highlights ??
        "Check-in gespeichert.",
      createdById: user.id,
      checkInSessionId: session.id,
      metadata: {
        moodRating: parsedInput.moodRating ?? null,
        nextStepsCount: nextStepItems.length,
      },
    });

    await Promise.all(
      createdCommitments.map((commitment) =>
        createTimelineEvent({
          coupleId: user.coupleId,
          kind: "COMMITMENT_CREATED",
          title: commitment.title,
          summary: "Aus dem Check-in als Commitment festgehalten.",
          createdById: user.id,
          commitmentId: commitment.id,
          checkInSessionId: session.id,
        })
      )
    );

    logEvent("info", "check_in_session_created", {
      coupleId: user.coupleId,
      checkInSessionId: session.id,
      commitmentCount: createdCommitments.length,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/check-in");
    revalidatePath("/dashboard/timeline");
    revalidatePath("/dashboard/reminders");
    revalidatePath("/dashboard/settings");

    return { id: session.id, commitmentCount: createdCommitments.length };
  });

export const createCommitment = action
  .schema(createCommitmentSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const objectiveId = parsedInput.objectiveId?.trim() || null;
    if (objectiveId) {
      const objective = await prisma.objective.findFirst({
        where: {
          id: objectiveId,
          coupleId: user.coupleId,
          archivedAt: null,
        },
        select: { id: true },
      });

      if (!objective) {
        throw new Error("Objective nicht gefunden.");
      }
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

    const dueAt = parsedInput.dueAt ? new Date(parsedInput.dueAt) : null;

    const commitment = await prisma.commitment.create({
      data: {
        coupleId: user.coupleId,
        objectiveId,
        title: parsedInput.title,
        details: parsedInput.details ?? null,
        ownerId,
        dueAt,
        source: "MANUAL",
        createdById: user.id,
      },
    });

    if (dueAt) {
      await syncCommitmentReminder({
        coupleId: user.coupleId,
        commitmentId: commitment.id,
        title: commitment.title,
        dueAt,
        createdById: user.id,
      });
    }

    await createTimelineEvent({
      coupleId: user.coupleId,
      kind: "COMMITMENT_CREATED",
      title: commitment.title,
      summary: commitment.details ?? "Commitment angelegt.",
      createdById: user.id,
      objectiveId: objectiveId ?? null,
      commitmentId: commitment.id,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/check-in");
    revalidatePath("/dashboard/timeline");
    revalidatePath("/dashboard/reminders");
    if (objectiveId) {
      revalidatePath(`/dashboard/objectives/${objectiveId}`);
    }

    return { id: commitment.id };
  });

export const updateCommitmentStatus = action
  .schema(updateCommitmentStatusSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const commitment = await prisma.commitment.findFirst({
      where: {
        id: parsedInput.commitmentId,
        coupleId: user.coupleId,
      },
      select: {
        id: true,
        title: true,
        objectiveId: true,
        source: true,
      },
    });

    if (!commitment) {
      throw new Error("Commitment nicht gefunden.");
    }

    const status = parsedInput.status === "DONE" ? "DONE" : "CANCELLED";

    await prisma.commitment.update({
      where: { id: commitment.id },
      data: {
        status,
        completedAt: new Date(),
      },
    });

    const reminder = await prisma.reminder.findFirst({
      where: {
        coupleId: user.coupleId,
        relatedType: "commitment",
        relatedId: commitment.id,
        status: "PENDING",
      },
      select: { id: true },
    });

    if (reminder) {
      await setReminderStatus({
        reminderId: reminder.id,
        coupleId: user.coupleId,
        status: parsedInput.status === "DONE" ? "DONE" : "DISMISSED",
      });
    }

    if (parsedInput.status === "DONE") {
      await createTimelineEvent({
        coupleId: user.coupleId,
        kind: "COMMITMENT_DONE",
        title: commitment.title,
        summary: "Commitment abgeschlossen.",
        createdById: user.id,
        objectiveId: commitment.objectiveId ?? null,
        commitmentId: commitment.id,
      });
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/timeline");
    revalidatePath("/dashboard/reminders");
    if (commitment.objectiveId) {
      revalidatePath(`/dashboard/objectives/${commitment.objectiveId}`);
    }

    return { updated: true };
  });

export const createTimelineNote = action
  .schema(createTimelineNoteSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const event = await createTimelineEvent({
      coupleId: user.coupleId,
      kind: "NOTE",
      title: parsedInput.title,
      summary: parsedInput.summary ?? null,
      createdById: user.id,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/timeline");

    return { id: event.id };
  });

export const updateReminderStatus = action
  .schema(updateReminderStatusSchema)
  .action(async ({ parsedInput }) => {
    const user = await requireUserWithCouple();

    const reminder = await setReminderStatus({
      reminderId: parsedInput.reminderId,
      coupleId: user.coupleId,
      status: parsedInput.status,
    });

    if (!reminder) {
      throw new Error("Reminder nicht gefunden.");
    }

    await createTimelineEvent({
      coupleId: user.coupleId,
      kind: "REMINDER",
      title: reminder.title,
      summary:
        parsedInput.status === "DONE"
          ? "Reminder erledigt."
          : "Reminder ausgeblendet.",
      createdById: user.id,
      reminderId: reminder.id,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/reminders");
    revalidatePath("/dashboard/timeline");

    return { updated: true };
  });
