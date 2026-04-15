import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedViewer } from "@/lib/active-couple";
import { RateLimitError, assertRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { generateChatCompletion, generateToolCallCompletion, type LlmMessage } from "@/lib/llm";
import {
  buildCoupleContext,
  buildKnowledgeContext,
  extractMiniRitualCandidates,
  formatThinkingPartnerResponse,
  inferTopicsFromQuery,
  searchTranscriptChunks,
  type TranscriptTopic,
} from "@/lib/thinking-partner";
import type { ThinkingPartnerAction } from "@/lib/thinking-partner-types";
import {
  thinkingPartnerResponseSchema,
  type ThinkingPartnerResponse,
} from "@/lib/validations/thinking-partner";

const MAX_MESSAGE_LENGTH = 1200;
const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_MESSAGE_LENGTH = 1200;

const historyMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(MAX_HISTORY_MESSAGE_LENGTH),
  })
  .strip();

const requestSchema = z
  .object({
    message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
    history: z.array(historyMessageSchema).max(MAX_HISTORY_MESSAGES).default([]),
    objectiveId: z.string().trim().min(1).nullable().optional(),
    keyResultId: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

const toolSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    impulses: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    nextStep: { type: "string" },
    questions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
    miniRitual: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        steps: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
      },
      required: ["title", "steps"],
    },
    objectiveRewrite: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        description: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
      required: ["title"],
    },
    keyResultRewrite: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        targetValue: { type: "number" },
        unit: { anyOf: [{ type: "string" }, { type: "null" }] },
      },
      required: ["title", "targetValue"],
    },
  },
  required: ["summary", "impulses", "nextStep", "questions"],
} as const;

function inferStylePreference(message: string, history: Array<{ role: "user" | "assistant"; content: string }>) {
  const userText = [...history, { role: "user" as const, content: message }]
    .filter((item) => item.role === "user")
    .map((item) => item.content)
    .join("\n")
    .toLowerCase();

  return {
    preferDaniel: /mehr\s+daniel|eher\s+daniel|bitte\s+daniel|daniel-stil|motivierender|inspirierender/.test(
      userText
    ),
    preferChristiane:
      /mehr\s+christiane|eher\s+christiane|bitte\s+christiane|nur\s+strukturier|präziser|praeziser|klarer|methodischer/.test(
        userText
      ),
    preferStructure:
      /nur\s+strukturier|bitte\s+nur\s+strukturier|präziser|praeziser|klarer|konkreter/.test(
        userText
      ),
    preferInspiration:
      /mehr\s+daniel|motivierender|ermutigend|inspirierender|lockerer|mehr\s+schwung/.test(
        userText
      ),
    openThenSharpen:
      /erst\s+inspiration,\s*dann\s+präzisier|erst\s+inspiration,\s*dann\s+praezisier|erst\s+inspiration\s+dann\s+präzisier|erst\s+inspiration\s+dann\s+praezisier|erst\s+öffnen,\s*dann\s+schärfen|erst\s+oeffnen,\s*dann\s+schaerfen/.test(
        userText
      ),
  };
}

export async function POST(req: Request) {
  const viewer = await getAuthenticatedViewer();

  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!viewer.activeCoupleId) {
    return NextResponse.json({ error: "No couple" }, { status: 404 });
  }

  let requestBody: unknown;

  try {
    requestBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  const parsedBody = requestSchema.safeParse(requestBody);

  if (!parsedBody.success) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { message, history, objectiveId, keyResultId } = parsedBody.data;

  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    include: {
      objectives: {
        where: {
          archivedAt: null,
          ...(objectiveId
            ? { id: objectiveId }
            : keyResultId
              ? { keyResults: { some: { id: keyResultId } } }
              : {}),
        },
        include: {
          quarter: true,
          keyResults: {
            where: { archivedAt: null },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      commitments: {
        where: { status: "OPEN" },
        include: {
          owner: { select: { name: true, email: true } },
          objective: { select: { title: true } },
        },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        take: 6,
      },
      checkInSessions: {
        orderBy: { createdAt: "desc" },
        take: 4,
      },
    },
  });

  if (!couple) {
    return NextResponse.json({ error: "No couple" }, { status: 404 });
  }

  try {
    await assertRateLimit({
      action: "thinking_partner_request",
      key: viewer.activeCoupleId,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Zu viele Anfragen. Bitte warte kurz und versuche es erneut." },
        { status: 429 }
      );
    }

    throw error;
  }

  const coupleContext = buildCoupleContext({
    name: couple.name,
    vision: couple.vision,
    mission: couple.mission,
    objectives: couple.objectives,
    commitments: couple.commitments,
    checkInSessions: couple.checkInSessions,
  });

  const topics = inferTopicsFromQuery(message);
  const stylePreference = inferStylePreference(message, history);
  const snippets = await searchTranscriptChunks(message, 6, topics, viewer.activeCoupleId);
  const knowledgeContext = buildKnowledgeContext(snippets);
  const ritualCandidates = extractMiniRitualCandidates(knowledgeContext);

  const stylePreferencePrompt = [
    stylePreference.preferDaniel
      ? "Nutzerwunsch: Daniel-Anteil etwas stärker machen: inspirierend, bildhaft, humorvoll, entlastend."
      : "",
    stylePreference.preferChristiane
      ? "Nutzerwunsch: Christiane-Anteil etwas stärker machen: präzise, strukturierend, methodisch klar, pragmatisch."
      : "",
    stylePreference.preferStructure
      ? "Nutzerwunsch: Bitte stärker strukturieren, Begriffe sauber trennen und Unschärfen konkret übersetzen."
      : "",
    stylePreference.preferInspiration
      ? "Nutzerwunsch: Bitte ermutigender, leichter und motivierender formulieren."
      : "",
    stylePreference.openThenSharpen
      ? "Nutzerwunsch: Erst Inspiration und Öffnung, dann Präzisierung und Konkretion."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = [
    "Du bist ein deutschsprachiger OKR-Coach für Paare.",
    "Du arbeitest im Stil eines eingespielten inneren Duos: Daniel bringt Richtung, Schwung, Bilder, Leichtigkeit und Ermutigung. Christiane bringt Präzision, Struktur, methodische Klarheit und pragmatische nächste Schritte.",
    "Standard: Antworte in einer integrierten gemeinsamen Stimme. Mache Daniel und Christiane nur dann sichtbar getrennt, wenn das dem Paar wirklich hilft. Dann kurz, klar, sparsam und nicht theatralisch.",
    "Grundhaltung: erst würdigen, dann schärfen. Erst Beziehung, dann Methode. Lieber Klarheit als Buzzwords. Lieber ein guter 80%-Schritt als Perfektion. Immer wieder vom Wozu und vom gewünschten Zustand her denken.",
    "Du bist warm, klar, alltagsnah, intelligent, menschlich und leicht humorvoll. Nicht kalt, nicht kitschig, nicht corporate-steif, nicht moralisch drückend.",
    "Du hilfst Paaren, Vision, Mission, Strategiefelder, Objectives und Key Results zu entwickeln, zu schärfen und im Alltag wirksam zu machen.",
    "Du unterscheidest sauber zwischen Vision, Mission, Strategiefeld, Objective, Key Result, Input, Output und Outcome.",
    "Prüfe fortlaufend: Ist das inspirierend oder nur nett klingend? Ist das konkret oder wolkig? Liegt es im Einflussbereich des Paares? Ist es ein Zustand oder nur ein To-do? Ist es eher Vision, Mission, Strategie oder schon OKR? Wenn alle Key Results erfüllt wären: wäre das Objective dann wirklich erreicht?",
    "Arbeitsweise: 1. kurz würdigen, was schon gut oder echt ist. 2. den eigentlichen Knackpunkt benennen. 3. klären, auf welcher Ebene wir gerade sind. 4. 1-3 präzise Rückfragen stellen oder direkt sinnvoll verdichten. 5. 1-3 Formulierungsvorschläge machen. 6. mit einem machbaren nächsten Schritt enden.",
    "Wenn emotionale Spannung sichtbar wird: nicht pathologisieren, nicht Partei ergreifen, das Muster würdigen, eventuell die dahinterliegende Sehnsucht benennen und dann zu einem hilfreichen nächsten Schritt zurückführen.",
    "Wenn der Nutzer etwas formulieren will, arbeite möglichst mit Varianten wie weichere Version, klarere Version, mutigere Version.",
    "Wenn es sinnvoll ist, darfst du natürliche Sätze nutzen wie: 'Da ist schon was richtig Gutes drin.', 'Spannend.', 'Wozu?', 'Was wäre der Zustand, wenn das gelungen ist?', '80 Prozent reichen erstmal.'",
    "Kein Therapie-Setting, keine Diagnosen, keine sterile Businesssprache, kein leeres Buzzword-Sprechen.",
    "WICHTIG: Gib dich nie als reale Person mit eigenen privaten Erinnerungen aus, wenn diese nicht direkt durch Quellen belegt sind.",
    "WICHTIG: Du MUSST deine Antwort als JSON via Tool-Aufruf liefern (kein Freitext).",
    "Format und Belegung der Felder: summary = kurze Würdigung plus Knackpunkt in 1-3 Sätzen. impulses = 2-4 konkrete Impulse, Verdichtungen oder Formulierungsvorschläge. nextStep = genau ein machbarer nächster Schritt. questions = 1-2 präzise Rückfragen, nur wenn sie wirklich helfen.",
    "Wenn das Paar Begriffe vermischt, benenne die Ebene in einfacher Sprache. Wenn sinnvoll, übersetze wolkige Aussagen in konkrete Formulierungen.",
    "Wenn möglich: schlage 1 Mini-Ritual vor (kurz, niedrigschwellig), bevorzugt basierend auf den Call-Snippets.",
    objectiveId
      ? "Wenn es sinnvoll ist, liefere zusätzlich objectiveRewrite (neuer Titel + optional Beschreibung) für das fokussierte Objective."
      : "",
    keyResultId
      ? "Wenn es sinnvoll ist, liefere zusätzlich keyResultRewrite (Titel + optional targetValue/unit) für das fokussierte Key Result."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const contextPrompt = `Kontext aus der App:\n${coupleContext}\n\nWissensbasis aus Coaching-Calls:\n${knowledgeContext}`;

  const ritualPrompt = ritualCandidates.length
    ? `Mini-Ritual Kandidaten (aus Calls, du darfst einen davon adaptieren):\n- ${ritualCandidates.join(
        "\n- "
      )}`
    : "Keine Mini-Ritual Kandidaten gefunden.";

  const sanitizedHistory: LlmMessage[] = history.map((item) => ({
    role: item.role,
    content: item.content,
  }));

  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: contextPrompt },
    {
      role: "system",
      content: stylePreferencePrompt || "Kein expliziter Stil-Override aus dem Nutzertext erkannt.",
    },
    { role: "system", content: ritualPrompt },
    ...sanitizedHistory,
    { role: "user", content: message },
  ];

  const toolResult = await generateToolCallCompletion(messages, {
    name: "thinking_partner_answer",
    description: "Erzeuge eine strukturierte, handlungsorientierte Antwort des OKR-Coachs.",
    parameters: toolSchema,
  });

  if (toolResult.error) {
    return NextResponse.json({ error: toolResult.error }, { status: 503 });
  }

  let structured: ThinkingPartnerResponse | null = null;
  let replyText = "";

  if (toolResult.toolArgumentsJson) {
    const parsed = thinkingPartnerResponseSchema.safeParse(toolResult.toolArgumentsJson);
    if (parsed.success) {
      structured = parsed.data;
      replyText = formatThinkingPartnerResponse(parsed.data);
    } else {
      const response = await generateChatCompletion(messages);
      if (response.error) {
        return NextResponse.json({ error: response.error }, { status: 503 });
      }
      replyText = response.content;
    }
  } else {
    const response = await generateChatCompletion(messages);
    if (response.error) {
      return NextResponse.json({ error: response.error }, { status: 503 });
    }
    replyText = response.content;
  }

  const actions: ThinkingPartnerAction[] = [];
  const combinedText = structured
    ? `${structured.summary}\n${structured.nextStep}\n${structured.impulses.join(" ")}`
    : replyText;

  if (/(check[- ]?in|wochencheck|kalender|termin)/i.test(combinedText)) {
    actions.push({ type: "OPEN_CHECKIN_SETTINGS", label: "Check-in planen" });
  }

  if (objectiveId) {
    actions.push({ type: "SAVE_NEXT_ACTION", label: "Nächste Aktion speichern" });
  }

  if (objectiveId && structured?.objectiveRewrite) {
    actions.push({
      type: "APPLY_OBJECTIVE_REWRITE",
      label: "Objective neu formulieren",
    });
  }

  if (keyResultId && structured?.keyResultRewrite) {
    actions.push({ type: "APPLY_KEY_RESULT_REWRITE", label: "Key Result vereinfachen" });
  }

  const sourceMap = new Map<
    string,
    {
      title: string;
      excerpt: string;
      topics: TranscriptTopic[] | null;
      speaker: string | null;
      kind: "wissen" | "stil";
    }
  >();

  snippets.forEach((snippet) => {
    sourceMap.set(snippet.id, {
      title: snippet.title,
      excerpt: snippet.content.slice(0, 220),
      topics: snippet.topics ?? null,
      speaker: snippet.speaker ?? null,
      kind: "wissen",
    });
  });

  return NextResponse.json({
    reply: replyText,
    structured,
    sources: Array.from(sourceMap.values()),
    actions,
  });
}
