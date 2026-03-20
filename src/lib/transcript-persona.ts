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

export function getPersonaGreeting(speaker?: PersonaSpeaker | null) {
  if (speaker === "DANIEL") {
    return "Hi, ich bin euer Thinking Partner im Daniel-Stil. Erzählt mir kurz, woran ihr gerade hängt.";
  }

  if (speaker === "CHRISTIANE") {
    return "Hi, ich bin euer Thinking Partner im Christiane-Stil. Erzählt mir kurz, was euch gerade beschäftigt.";
  }

  return "Hi! Ich bin euer Thinking Partner. Erzählt mir kurz, was euch gerade beschäftigt.";
}
