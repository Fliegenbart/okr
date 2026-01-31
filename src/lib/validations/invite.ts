import { z } from "zod";

export const createInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Bitte gib eine gueltige E-Mail ein.")
    .transform((value) => value.toLowerCase()),
});

export const acceptInviteSchema = z.object({
  token: z.string().trim().min(10, "Token ist ungueltig."),
});
