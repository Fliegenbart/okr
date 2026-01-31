import { z } from "zod";

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(80).optional()
);

const numberFromInput = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }
    return value;
  },
  z.number({ message: "Bitte gib eine Zahl ein." }).min(0.1, "Ziel muss > 0 sein.")
);

export const createKeyResultSchema = z.object({
  objectiveId: z.string().min(1),
  title: z.string().trim().min(2, "Bitte gib ein Key Result an.").max(80),
  targetValue: numberFromInput,
  unit: optionalText,
});

export const updateKeyResultMetaSchema = z.object({
  keyResultId: z.string().min(1),
  title: z.string().trim().min(2, "Bitte gib ein Key Result an.").max(80),
  targetValue: numberFromInput,
  unit: optionalText,
});

export const archiveKeyResultSchema = z.object({
  keyResultId: z.string().min(1),
});

export const restoreKeyResultSchema = z.object({
  keyResultId: z.string().min(1),
});
