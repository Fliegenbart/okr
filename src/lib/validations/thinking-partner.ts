import { z } from "zod";

export const thinkingPartnerMiniRitualSchema = z
  .object({
    title: z.string().trim().min(2).max(80),
    steps: z.array(z.string().trim().min(2).max(160)).min(1).max(6),
  })
  .strict();

export const thinkingPartnerObjectiveRewriteSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    description: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const thinkingPartnerKeyResultRewriteSchema = z
  .object({
    title: z.string().trim().min(2).max(140),
    targetValue: z.number().positive().finite(),
    unit: z.string().trim().max(24).optional().nullable(),
  })
  .strict();

export const thinkingPartnerResponseSchema = z
  .object({
    summary: z.string().trim().min(2).max(500),
    impulses: z.array(z.string().trim().min(2).max(260)).min(2).max(4),
    nextStep: z.string().trim().min(2).max(260),
    questions: z.array(z.string().trim().min(2).max(240)).min(1).max(2),
    miniRitual: thinkingPartnerMiniRitualSchema.optional(),
    objectiveRewrite: thinkingPartnerObjectiveRewriteSchema.optional(),
    keyResultRewrite: thinkingPartnerKeyResultRewriteSchema.optional(),
  })
  .strict();

export type ThinkingPartnerResponse = z.infer<typeof thinkingPartnerResponseSchema>;
