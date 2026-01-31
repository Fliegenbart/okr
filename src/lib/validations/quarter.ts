import { z } from "zod";

const dateFromInput = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    if (!value) return value;
    return new Date(`${value}T00:00:00`);
  },
  z.date({ message: "Bitte gib ein gueltiges Datum an." })
);

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(60).optional()
);

export const createQuarterSchema = z
  .object({
    title: optionalText,
    startsAt: dateFromInput,
    endsAt: dateFromInput,
  })
  .refine(
    (data) => data.endsAt >= data.startsAt,
    "Enddatum muss nach dem Startdatum liegen."
  );

export const setPreferredQuarterSchema = z.object({
  quarterId: z.string().trim().optional(),
});
