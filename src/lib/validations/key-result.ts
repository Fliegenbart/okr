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

export const updateKeyResultSchema = z
  .object({
    keyResultId: z.string().min(1),
    type: z.enum(KEY_RESULT_TYPES).optional(),
    value: optionalValue,
    achieved: z.boolean().optional(),
    note: optionalNote,
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
