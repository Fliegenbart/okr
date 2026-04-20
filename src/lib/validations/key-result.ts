import { z } from "zod";

import { KEY_RESULT_TYPES } from "@/lib/key-results";

const optionalNote = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(200, "Notiz ist zu lang.").optional()
);

const optionalValue = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }
    return value;
  },
  z.number({ message: "Bitte gib einen gültigen Wert ein." }).min(0, "Der Wert muss positiv sein.").optional()
);

// Accepts ISO date string (from <input type="date">) or Date.
// Empty string / undefined / null collapse to undefined so the caller may
// omit the field entirely and the server falls back to createdAt = now().
const optionalDate = z
  .union([z.date(), z.string(), z.null()])
  .optional()
  .transform((value): Date | undefined => {
    if (value === undefined || value === null) return undefined;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
    if (typeof value === "string" && value.trim() === "") return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  });

export const updateKeyResultSchema = z
  .object({
    keyResultId: z.string().min(1),
    type: z.enum(KEY_RESULT_TYPES).optional(),
    value: optionalValue,
    achieved: z.boolean().optional(),
    note: optionalNote,
    occurredAt: optionalDate,
  })
  .superRefine((value, ctx) => {
    if (value.type === "BINARY") {
      if (typeof value.achieved !== "boolean") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bitte wähle erreicht oder nicht erreicht.",
          path: ["achieved"],
        });
      }
      return;
    }

    if (typeof value.value !== "number" || Number.isNaN(value.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitte gib einen gültigen Wert ein.",
        path: ["value"],
      });
    }
  });
