import { z } from "zod";

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(200).optional()
);

export const createCoupleSchema = z.object({
  name: z.string().trim().min(2, "Bitte gebt einen Namen an.").max(60),
  vision: optionalText,
});

export const updateCoupleSchema = z.object({
  name: z.string().trim().min(2, "Bitte gebt einen Namen an.").max(60),
  vision: optionalText,
});

export const joinCoupleSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(4, "Bitte gebt einen Einladungscode ein.")
    .max(16)
    .regex(/^[a-zA-Z0-9]+$/, "Nur Buchstaben und Zahlen sind erlaubt.")
    .transform((value) => value.toUpperCase()),
});
