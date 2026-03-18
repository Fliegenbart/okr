import { z } from "zod";

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(2000).optional()
);

const nullableDateText = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().datetime({ offset: true }).nullable()
);

const moodRating = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }
    return value;
  },
  z.number().int().min(1).max(5).nullable().optional()
);

const lineSeparatedText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().max(4000).nullable().optional()
);

export const createCheckInSessionSchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    templateKey: z.string().trim().optional().nullable(),
    quarterId: z.string().trim().optional().nullable(),
    moodRating,
    highlights: optionalText,
    tensions: optionalText,
    summary: optionalText,
    nextSteps: lineSeparatedText,
  })
  .strict();

export const createCommitmentSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    details: optionalText,
    ownerId: z.string().trim().optional().nullable(),
    objectiveId: z.string().trim().optional().nullable(),
    dueAt: nullableDateText,
  })
  .strict();

export const updateCommitmentStatusSchema = z
  .object({
    commitmentId: z.string().min(1),
    status: z.enum(["DONE", "CANCELLED"]),
  })
  .strict();

export const createTimelineNoteSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    summary: optionalText,
  })
  .strict();

export const updateReminderStatusSchema = z
  .object({
    reminderId: z.string().min(1),
    status: z.enum(["DONE", "DISMISSED"]),
  })
  .strict();
