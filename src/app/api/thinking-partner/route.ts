import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/auth";
import { assertRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import {
  generateChatCompletion,
  generateToolCallCompletion,
  type LlmMessage,
} from "@/lib/llm";
import {
  buildCoupleContext,
  buildKnowledgeContext,
  inferTopicsFromQuery,
  searchTranscriptChunks,
} from "@/lib/thinking-partner";
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
  .strict();

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

function extractMiniRitualCandidates(text: string) {
  const candidates: string[] = [];
  const regex = /Mikro-Ritual:\s*([^.\n]+(?:\.[^.\n]+){0,2})/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1]?.trim();
    if (raw && raw.length >= 10) candidates.push(raw);
    if (candidates.length >= 6) break;
  }
  return Array.from(new Set(candidates));
}

function formatStructuredAsText(answer: ThinkingPartnerResponse) {
  const lines = [
    answer.summary,
    "",
    "Impulse:",
    ...answer.impulses.map((item) => `- ${item}`),
    "",
    `Nächster Schritt: ${answer.nextStep}`,
    "",
    "Rückfragen:",
    ...answer.questions.map((item) => `- ${item}`),
  ];

  if (answer.miniRitual) {
    lines.push("", `Mini-Ritual: ${answer.miniRitual.title}`);
    answer.miniRitual.steps.forEach((step) => {
      lines.push(`- ${step}`);
    });
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = requestSchema.safeParse(await req.json().catch(() => null));

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "Ungültige Anfrage." },
      { status: 400 }
    );
  }

  const { message, history, objectiveId, keyResultId } = parsedBody.data;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      couple: {
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
      },
    },
  });

  if (!user?.couple) {
    return NextResponse.json({ error: "No couple" }, { status: 404 });
  }

  try {
    await assertRateLimit({
      action: "thinking_partner_request",
      key: user.coupleId!,
      limit: 20,
      windowMs: 15 * 60 * 1000,
    });
  } catch {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte warte kurz und versuche es erneut." },
      { status: 429 }
    );
  }

  const coupleContext = buildCoupleContext({
    name: user.couple.name,
    vision: user.couple.vision,
    mission: user.couple.mission,
    objectives: user.couple.objectives,
    commitments: user.couple.commitments,
    checkInSessions: user.couple.checkInSessions,
  });

  const topics = inferTopicsFromQuery(message);
  const snippets = await searchTranscriptChunks(
    message,
    6,
    topics,
    user.coupleId
  );
  const knowledgeContext = buildKnowledgeContext(snippets);
  const ritualCandidates = extractMiniRitualCandidates(knowledgeContext);

  const systemPrompt = [
    "Du bist ein Thinking Partner für Paare. Du hilfst, gemeinsame Objectives und Key Results zu erreichen.",
    "Antworte auf Deutsch, klar, warm, handlungsorientiert. Kein Therapie-Setting, keine Diagnosen.",
    "WICHTIG: Du MUSST deine Antwort als JSON via Tool-Aufruf liefern (kein Freitext).",
    "Format: Kurzfassung (1-3 Sätze) -> 2-4 Impulse -> 1 nächster Schritt -> 1-2 Rückfragen.",
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

  const sanitizedHistory: LlmMessage[] = history
    .map((item) => ({
      role: item.role,
      content: item.content,
    }));

  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: contextPrompt },
    { role: "system", content: ritualPrompt },
    ...sanitizedHistory,
    { role: "user", content: message },
  ];

  const toolResult = await generateToolCallCompletion(messages, {
    name: "thinking_partner_answer",
    description:
      "Erzeuge eine strukturierte, handlungsorientierte Thinking-Partner Antwort.",
    parameters: toolSchema,
  });

  let structured: ThinkingPartnerResponse | null = null;
  let replyText = "";
  let fallback = Boolean(toolResult.isFallback);

  if (toolResult.toolArgumentsJson) {
    const parsed = thinkingPartnerResponseSchema.safeParse(
      toolResult.toolArgumentsJson
    );
    if (parsed.success) {
      structured = parsed.data;
      replyText = formatStructuredAsText(parsed.data);
    } else {
      const response = await generateChatCompletion(messages);
      fallback = true;
      replyText = response.content;
    }
  } else {
    const response = await generateChatCompletion(messages);
    fallback = Boolean(response.isFallback);
    replyText = response.content;
  }

  const actions: Array<{ type: string; label: string }> = [];
  const combinedText = structured
    ? `${structured.summary}\n${structured.nextStep}\n${structured.impulses.join(
        " "
      )}`
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
      label: "Objective umformulieren",
    });
  }

  if (keyResultId && structured?.keyResultRewrite) {
    actions.push({ type: "APPLY_KEY_RESULT_REWRITE", label: "KR vereinfachen" });
  }

  return NextResponse.json({
    reply: replyText,
    structured,
    sources: snippets.map((snippet) => ({
      title: snippet.title,
      excerpt: snippet.content.slice(0, 220),
      topics: snippet.topics ?? null,
    })),
    actions,
    fallback,
  });
}
