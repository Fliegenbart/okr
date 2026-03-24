export const personaSpeakerValues = ["DANIEL", "CHRISTIANE"] as const;

export type PersonaSpeaker = (typeof personaSpeakerValues)[number];

export type PersonaProfileSnapshot = {
  styleSummary: string;
  toneDescriptors: string[];
  recurringPhrases: string[];
  vocabulary: string[];
  avoidPatterns: string[];
  sampleCount: number;
};

export function isPersonaSpeaker(value: unknown): value is PersonaSpeaker {
  return typeof value === "string" && personaSpeakerValues.includes(value as PersonaSpeaker);
}

export function getPersonaLabel(speaker: PersonaSpeaker) {
  return speaker === "DANIEL" ? "Daniel" : "Christiane";
}

export function getTranscriptSpeakerLabel(speaker?: string | null): string | null {
  if (!speaker) return null;

  if (speaker === "DANIEL") return "Daniel";
  if (speaker === "CHRISTIANE") return "Christiane";
  if (speaker === "MIXED") return "Daniel + Christiane";
  if (speaker === "OTHER") return "Andere Stimme";
  if (speaker === "UNKNOWN") return "Unklare Stimme";

  return speaker;
}

export function getOkrCoachGreeting() {
  return "Hi! Ich bin euer OKR-Coach für Paare. Erzählt mir kurz, woran ihr gerade hängt, was ihr schärfen wollt oder wo ihr im Alltag nicht recht ins Tun kommt.";
}
