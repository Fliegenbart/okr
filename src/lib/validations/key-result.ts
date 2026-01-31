import { z } from "zod";

const optionalNote = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(200, "Notiz ist zu lang.").optional()
);

export const updateKeyResultSchema = z.object({
  keyResultId: z.string().min(1),
  value: z
    .number({ message: "Bitte gib einen gueltigen Wert ein." })
    .min(0, "Der Wert muss positiv sein."),
  note: optionalNote,
});
