import { z } from "zod";

import { KEY_RESULT_DIRECTIONS, KEY_RESULT_TYPES } from "@/lib/key-results";

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(80).optional()
);

const optionalLongText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(4000, "Beschreibung ist zu lang.").optional()
);

const numberFromInput = z.preprocess(
  (value) => {
    if (typeof value === "string" && value.trim() !== "") {
      return Number(value);
    }
    return value;
  },
  z.number({ message: "Bitte gib eine Zahl ein." })
);

const optionalNumberFromInput = z.preprocess(
  (value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return undefined;
      return Number(trimmed);
    }
    return value;
  },
  z.number({ message: "Bitte gib eine Zahl ein." }).optional()
);

const requiredNonNegativeNumber = numberFromInput.refine(
  (value) => Number.isFinite(value) && value >= 0,
  "Bitte gib eine Zahl ab 0 ein."
);

const optionalNonNegativeNumber = optionalNumberFromInput.refine(
  (value) => value === undefined || (Number.isFinite(value) && value >= 0),
  "Bitte gib eine Zahl ab 0 ein."
);

const keyResultMetaFields = z
  .object({
    title: z.string().trim().min(2, "Bitte gib ein Key Result an.").max(80),
    type: z.enum(KEY_RESULT_TYPES),
    direction: z.enum(KEY_RESULT_DIRECTIONS).default("HIGHER_IS_BETTER"),
    targetValue: requiredNonNegativeNumber,
    startValue: requiredNonNegativeNumber,
    unit: optionalText,
    description: optionalLongText,
    redThreshold: optionalNonNegativeNumber,
    yellowThreshold: optionalNonNegativeNumber,
    greenThreshold: optionalNonNegativeNumber,
  })
  .superRefine((value, ctx) => {
    if (value.type === "BINARY") {
      return;
    }

    if (value.type === "TRAFFIC_LIGHT") {
      if (
        value.redThreshold === undefined ||
        value.yellowThreshold === undefined ||
        value.greenThreshold === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bitte gib rot, gelb und grün für die Ampel an.",
          path: ["redThreshold"],
        });
        return;
      }

      if (value.direction === "HIGHER_IS_BETTER") {
        if (!(value.redThreshold <= value.yellowThreshold && value.yellowThreshold <= value.greenThreshold)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Bei 'mehr ist besser' muss rot <= gelb <= grün sein.",
            path: ["yellowThreshold"],
          });
        }
      } else if (!(value.greenThreshold <= value.yellowThreshold && value.yellowThreshold <= value.redThreshold)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Bei 'weniger ist besser' muss grün <= gelb <= rot sein.",
          path: ["yellowThreshold"],
        });
      }

      return;
    }

    if (value.targetValue < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitte gib einen gültigen Zielwert ein.",
        path: ["targetValue"],
      });
    }
  });

export const createKeyResultSchema = z.object({
  objectiveId: z.string().min(1),
}).merge(keyResultMetaFields);

export const updateKeyResultMetaSchema = z.object({
  keyResultId: z.string().min(1),
  title: z.string().trim().min(2, "Bitte gib ein Key Result an.").max(80),
  type: z.enum(KEY_RESULT_TYPES).optional(),
  direction: z.enum(KEY_RESULT_DIRECTIONS).optional(),
  targetValue: optionalNonNegativeNumber.optional(),
  startValue: optionalNonNegativeNumber.optional(),
  unit: optionalText.optional(),
  description: optionalLongText.optional(),
  redThreshold: optionalNonNegativeNumber.optional(),
  yellowThreshold: optionalNonNegativeNumber.optional(),
  greenThreshold: optionalNonNegativeNumber.optional(),
});

export const archiveKeyResultSchema = z.object({
  keyResultId: z.string().min(1),
});

export const restoreKeyResultSchema = z.object({
  keyResultId: z.string().min(1),
});

export const objectiveKeyResultSchema = keyResultMetaFields;
