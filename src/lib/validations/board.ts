import { z } from "zod";

const idSchema = z.string().trim().min(1).max(64);

const optionalTitle = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(120, "Bitte maximal 120 Zeichen.").optional()
);

const optionalContent = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(2000, "Bitte maximal 2000 Zeichen.").optional()
);

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Bitte eine gültige Farbe angeben.");

const optionalColor = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  colorSchema.optional()
);

const coordinateSchema = z
  .number()
  .finite()
  .min(-4000, "Wert ist zu klein.")
  .max(4000, "Wert ist zu gross.");

const sizeSchema = z
  .number()
  .finite()
  .min(80, "Wert ist zu klein.")
  .max(1600, "Wert ist zu gross.");

export const boardScopeSchema = z.enum(["MASTER", "QUARTER"]);
export const boardElementTypeSchema = z.enum(["NOTE", "TEXT", "FRAME"]);

export const ensureBoardSchema = z
  .object({
    scope: boardScopeSchema,
    quarterId: idSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.scope === "QUARTER" && !value.quarterId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bitte ein Quartal wählen.",
        path: ["quarterId"],
      });
    }

    if (value.scope === "MASTER" && value.quarterId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Master-Boards dürfen kein Quartal haben.",
        path: ["quarterId"],
      });
    }
  });

export const createBoardElementSchema = z.object({
  boardId: idSchema,
  type: boardElementTypeSchema,
  x: coordinateSchema,
  y: coordinateSchema,
  width: sizeSchema.optional(),
  height: sizeSchema.optional(),
  title: optionalTitle,
  content: optionalContent,
  color: optionalColor,
});

export const updateBoardElementSchema = z
  .object({
    elementId: idSchema,
    title: optionalTitle,
    content: optionalContent,
    color: optionalColor,
    width: sizeSchema.optional(),
    height: sizeSchema.optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.content !== undefined ||
      value.color !== undefined ||
      value.width !== undefined ||
      value.height !== undefined,
    "Bitte mindestens ein Feld aktualisieren."
  );

export const moveBoardElementSchema = z.object({
  elementId: idSchema,
  x: coordinateSchema,
  y: coordinateSchema,
  zIndex: z.number().int().min(0).max(10000),
});

export const moveBoardElementsSchema = z.object({
  moves: z
    .array(
      z.object({
        elementId: idSchema,
        x: coordinateSchema,
        y: coordinateSchema,
        zIndex: z.number().int().min(0).max(10000),
      })
    )
    .min(1, "Bitte mindestens ein Element verschieben.")
    .max(24, "Bitte nicht zu viele Elemente gleichzeitig verschieben."),
});

export const deleteBoardElementSchema = z.object({
  elementId: idSchema,
});

export const deleteBoardElementsSchema = z.object({
  elementIds: z
    .array(idSchema)
    .min(1, "Bitte mindestens ein Element auswählen.")
    .max(24, "Bitte nicht zu viele Elemente gleichzeitig löschen."),
});

export const createBoardConnectionSchema = z
  .object({
    firstElementId: idSchema,
    secondElementId: idSchema,
    color: optionalColor,
  })
  .refine(
    (value) => value.firstElementId !== value.secondElementId,
    "Bitte zwei unterschiedliche Elemente auswählen."
  );

export const deleteBoardConnectionSchema = z.object({
  connectionId: idSchema,
});
