import { z } from "zod";

export const bulkBetaAccessSchema = z.object({
  entries: z
    .string()
    .trim()
    .min(1, "Bitte füge mindestens eine E-Mail ein.")
    .max(8000, "Die Liste ist zu lang."),
});

export const createBetaCoupleSchema = z.object({
  coupleName: z
    .string()
    .trim()
    .min(2, "Bitte gib einen Couple-Namen ein.")
    .max(120, "Der Couple-Name ist zu lang."),
  partnerOneEmail: z
    .string()
    .trim()
    .email("Bitte gib eine gültige E-Mail für Person 1 ein."),
  partnerTwoEmail: z
    .string()
    .trim()
    .max(320, "Die E-Mail für Person 2 ist zu lang.")
    .optional()
    .transform((value) => value ?? ""),
});
