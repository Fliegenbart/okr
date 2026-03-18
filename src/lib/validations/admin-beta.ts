import { z } from "zod";

export const bulkBetaAccessSchema = z.object({
  entries: z
    .string()
    .trim()
    .min(1, "Bitte füge mindestens eine E-Mail ein.")
    .max(8000, "Die Liste ist zu lang."),
});
