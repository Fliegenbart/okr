import { z } from "zod";

const optionalText = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  },
  z.string().max(400, "Bitte maximal 400 Zeichen.").optional()
);

export const visionMissionSchema = z.object({
  vision: optionalText,
  mission: optionalText,
});
