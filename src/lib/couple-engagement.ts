import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TimelineEventKind =
  | "CHECK_IN"
  | "OBJECTIVE_UPDATE"
  | "COMMITMENT_CREATED"
  | "COMMITMENT_DONE"
  | "NOTE"
  | "MILESTONE"
  | "REMINDER";

export type ConversationTemplate = {
  key: string;
  title: string;
  description: string;
  focus: string;
  questions: string[];
  followUps: string[];
};

export const conversationTemplates: ConversationTemplate[] = [
  {
    key: "weekly-checkin",
    title: "Wochen-Check",
    description: "Kurz zusammenkommen, Gefühl einordnen und die Woche ordnen.",
    focus: "Wertschätzung, Spannungen, nächste Schritte",
    questions: [
      "Was hat uns diese Woche gut getan?",
      "Wo hat es gehakt oder Druck gegeben?",
      "Was wollen wir bis zum nächsten Wochen-Check anders machen?",
    ],
    followUps: ["1 Commitment festhalten", "Termin für den nächsten Wochen-Check prüfen"],
  },
  {
    key: "conflict-reset",
    title: "Konflikt klären",
    description: "Ein ruhiger Rahmen für Reparatur, Verständnis und Vereinbarung.",
    focus: "Repair statt Recht behalten",
    questions: [
      "Was ist aus deiner Sicht eigentlich passiert?",
      "Was hat dich daran am stärksten getroffen?",
      "Was brauchst du jetzt von mir?",
    ],
    followUps: ["Missverständnis benennen", "Nächste konkrete Reparatur notieren"],
  },
  {
    key: "quarter-review",
    title: "Quartalsreview",
    description: "Zurückschauen, Fortschritt sehen und das nächste Quartal schärfen.",
    focus: "Lernen, Richtung, Prioritäten",
    questions: [
      "Was hat dieses Quartal wirklich bewegt?",
      "Was sollten wir beenden oder reduzieren?",
      "Welche 1-3 Dinge sind im nächsten Quartal wichtig?",
    ],
    followUps: ["Quarter-Objective aktualisieren", "Überfällige Commitments prüfen"],
  },
  {
    key: "goal-setting",
    title: "Ziele setzen",
    description: "Ein gemeinsamer Frame für Prioritäten und Ownership.",
    focus: "Klarheit und Verantwortung",
    questions: [
      "Was ist das Ergebnis, das wir erreichen wollen?",
      "Woran merken wir in 4-8 Wochen Fortschritt?",
      "Wer übernimmt was?",
    ],
    followUps: ["Objective anlegen", "Erstes Next Action festhalten"],
  },
  {
    key: "connection-boost",
    title: "Verbindung stärken",
    description: "Bewusst Zeit für Nähe, Leichtigkeit und Beziehungspflege.",
    focus: "Nähe, Präsenz, Rituale",
    questions: [
      "Was hat uns zuletzt verbunden?",
      "Was wünschen wir uns mehr voneinander?",
      "Welches kleine Ritual passt diese Woche?",
    ],
    followUps: ["Mini-Ritual wählen", "Date Night oder Ruhezeit planen"],
  },
];

function parseTime(time: string) {
  const [hours, minutes] = time.split(":").map((part) => Number(part));
  return { hours, minutes };
}

export function normalizeChecklistItems(text?: string | null) {
  return (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

export function computeNextOccurrence(
  weekday: number,
  time: string,
  now = new Date()
) {
  const { hours, minutes } = parseTime(time);
  const target = weekday % 7;
  const today = now.getDay();

  let delta = target - today;
  if (delta < 0) delta += 7;

  const next = new Date(now);
  next.setDate(now.getDate() + delta);
  next.setHours(hours, minutes, 0, 0);

  if (delta === 0 && next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
  }

  return next;
}

export function getQuarterReviewDueAt(endsAt: Date) {
  return new Date(endsAt.getTime() - 7 * DAY_MS);
}

export async function syncObjectiveCommitment(input: {
  objectiveId: string;
  coupleId: string;
  title: string | null;
  ownerId?: string | null;
  createdById?: string | null;
}) {
  const existing = await prisma.commitment.findFirst({
    where: {
      objectiveId: input.objectiveId,
      source: "OBJECTIVE",
      status: "OPEN",
    },
    select: { id: true },
  });

  if (!input.title) {
    if (existing) {
      await prisma.commitment.update({
        where: { id: existing.id },
        data: {
          status: "CANCELLED",
          completedAt: new Date(),
        },
      });
    }

    return null;
  }

  const data = {
    coupleId: input.coupleId,
    objectiveId: input.objectiveId,
    title: input.title,
    ownerId: input.ownerId ?? null,
    source: "OBJECTIVE" as const,
    createdById: input.createdById ?? null,
    status: "OPEN" as const,
    completedAt: null,
  };

  if (existing) {
    return prisma.commitment.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.commitment.create({ data });
}

export async function createTimelineEvent(input: {
  coupleId: string;
  kind: TimelineEventKind;
  title: string;
  summary?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  createdById?: string | null;
  objectiveId?: string | null;
  commitmentId?: string | null;
  checkInSessionId?: string | null;
  reminderId?: string | null;
}) {
  return prisma.timelineEvent.create({
    data: {
      coupleId: input.coupleId,
      kind: input.kind,
      title: input.title,
      summary: input.summary ?? null,
      metadata: input.metadata ?? undefined,
      createdById: input.createdById ?? null,
      objectiveId: input.objectiveId ?? null,
      commitmentId: input.commitmentId ?? null,
      checkInSessionId: input.checkInSessionId ?? null,
      reminderId: input.reminderId ?? null,
    },
  });
}

export async function upsertReminder(input: {
  coupleId: string;
  kind: "CHECK_IN" | "COMMITMENT" | "QUARTER_REVIEW";
  title: string;
  dueAt: Date;
  body?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  createdById?: string | null;
  quarterId?: string | null;
  commitmentId?: string | null;
  checkInSessionId?: string | null;
}) {
  const existing = await prisma.reminder.findFirst({
    where: {
      coupleId: input.coupleId,
      kind: input.kind,
      relatedType: input.relatedType ?? null,
      relatedId: input.relatedId ?? null,
      status: "PENDING",
    },
    select: { id: true },
  });

  const data = {
    coupleId: input.coupleId,
    quarterId: input.quarterId ?? null,
    commitmentId: input.commitmentId ?? null,
    checkInSessionId: input.checkInSessionId ?? null,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    dueAt: input.dueAt,
    relatedType: input.relatedType ?? null,
    relatedId: input.relatedId ?? null,
    createdById: input.createdById ?? null,
    status: "PENDING" as const,
    completedAt: null,
    dismissedAt: null,
  };

  if (existing) {
    return prisma.reminder.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.reminder.create({ data });
}

export async function setReminderStatus(input: {
  reminderId: string;
  status: "DONE" | "DISMISSED";
  coupleId: string;
}) {
  const existing = await prisma.reminder.findFirst({
    where: { id: input.reminderId, coupleId: input.coupleId },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  return prisma.reminder.update({
    where: { id: existing.id },
    data:
      input.status === "DONE"
        ? { status: "DONE", completedAt: new Date(), dismissedAt: null }
        : { status: "DISMISSED", dismissedAt: new Date(), completedAt: null },
  });
}
