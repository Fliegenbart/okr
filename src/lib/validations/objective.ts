import { z } from "zod";

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(200).optional()
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

const keyResultSchema = z.object({
  title: z.string().trim().min(2, "Bitte gib ein Key Result an.").max(80),
  targetValue: numberFromInput,
  unit: optionalText,
});

export const createObjectiveSchema = z.object({
  title: z.string().trim().min(2, "Bitte gib ein Objective an.").max(120),
  description: optionalText,
  quarterId: z.string().trim().optional(),
  keyResults: z
    .array(keyResultSchema)
    .min(2, "Bitte gib mindestens zwei Key Results an.")
    .max(6, "Maximal 6 Key Results pro Objective."),
});

export const updateObjectiveSchema = z.object({
  objectiveId: z.string().min(1),
  title: z.string().trim().min(2, "Bitte gib ein Objective an.").max(120),
  description: optionalText,
  quarterId: z.string().trim().optional(),
});

export const archiveObjectiveSchema = z.object({
  objectiveId: z.string().min(1),
});

export const restoreObjectiveSchema = z.object({
  objectiveId: z.string().min(1),
});

const nextActionText = z.preprocess(
  (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().min(2, "Bitte gib eine naechste Aktion an.").max(220).nullable()
);

export const setObjectiveNextActionSchema = z.object({
  objectiveId: z.string().min(1),
  nextAction: nextActionText,
  ownerId: z.string().min(1).optional().nullable(),
});
