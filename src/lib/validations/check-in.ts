import { z } from "zod";

export const checkInScheduleSchema = z
  .object({
    enabled: z.boolean(),
    weekday: z
      .number({ message: "Bitte waehle einen Wochentag." })
      .int()
      .min(1)
      .max(7)
      .optional(),
    time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Bitte gib eine Uhrzeit im Format HH:MM ein.")
      .optional(),
    durationMinutes: z
      .number({ message: "Bitte gib eine Dauer an." })
      .int()
      .min(5)
      .max(120)
      .optional(),
    timeZone: z.string().min(1).max(64).optional(),
  })
  .refine(
    (value) => {
      if (!value.enabled) return true;
      return Boolean(value.weekday && value.time && value.durationMinutes);
    },
    {
      message: "Bitte Wochentag, Uhrzeit und Dauer ausfuellen.",
      path: ["enabled"],
    }
  );
