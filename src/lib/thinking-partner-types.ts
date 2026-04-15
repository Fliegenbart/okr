import type { TranscriptTopic } from "@/lib/thinking-partner";
import type { ThinkingPartnerResponse } from "@/lib/validations/thinking-partner";

export type ThinkingPartnerStructuredAnswer = ThinkingPartnerResponse;

export type ThinkingPartnerActionType =
  | "OPEN_CHECKIN_SETTINGS"
  | "SAVE_NEXT_ACTION"
  | "APPLY_OBJECTIVE_REWRITE"
  | "APPLY_KEY_RESULT_REWRITE"
  | "OPEN_THINKING_PARTNER";

export type ThinkingPartnerAction = {
  type: ThinkingPartnerActionType;
  label: string;
};

export type ThinkingPartnerSource = {
  title: string;
  excerpt: string;
  topics?: TranscriptTopic[] | null;
  speaker?: string | null;
  kind?: "wissen" | "stil";
};

export type ThinkingPartnerApiResponse = {
  reply: string;
  structured: ThinkingPartnerStructuredAnswer | null;
  sources: ThinkingPartnerSource[];
  actions: ThinkingPartnerAction[];
};

export type PowerMoveApiResponse = ThinkingPartnerApiResponse & {
  quarter: {
    id: string;
    title: string;
  };
};
