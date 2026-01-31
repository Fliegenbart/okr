import { NextResponse } from "next/server";

import { getAuthSession } from "@/auth";
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
    `Naechster Schritt: ${answer.nextStep}`,
    "",
    "Rueckfragen:",
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

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const history: unknown[] = Array.isArray(body?.history) ? body.history : [];
  const objectiveId =
    typeof body?.objectiveId === "string" ? body.objectiveId : null;
  const keyResultId =
    typeof body?.keyResultId === "string" ? body.keyResultId : null;

  if (!message) {
    return NextResponse.json(
      { error: "Nachricht fehlt." },
      { status: 400 }
    );
  }

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
        },
      },
    },
  });

  if (!user?.couple) {
    return NextResponse.json({ error: "No couple" }, { status: 404 });
  }

  const coupleContext = buildCoupleContext({
    name: user.couple.name,
    vision: user.couple.vision,
    mission: user.couple.mission,
    objectives: user.couple.objectives,
  });

  const topics = inferTopicsFromQuery(message);
  const snippets = await searchTranscriptChunks(message, 6, topics);
  const knowledgeContext = buildKnowledgeContext(snippets);
  const ritualCandidates = extractMiniRitualCandidates(knowledgeContext);

  const systemPrompt = [
    "Du bist ein Thinking Partner fuer Paare. Du hilfst, gemeinsame Objectives und Key Results zu erreichen.",
    "Antworte auf Deutsch, klar, warm, handlungsorientiert. Kein Therapie-Setting, keine Diagnosen.",
    "WICHTIG: Du MUSST deine Antwort als JSON via Tool-Aufruf liefern (kein Freitext).",
    "Format: Kurzfassung (1-3 Saetze) -> 2-4 Impulse -> 1 naechster Schritt -> 1-2 Rueckfragen.",
    "Wenn moeglich: schlage 1 Mini-Ritual vor (kurz, niedrigschwellig), bevorzugt basierend auf den Call-Snippets.",
    objectiveId
      ? "Wenn es sinnvoll ist, liefere zusaetzlich objectiveRewrite (neuer Titel + optional Beschreibung) fuer das fokussierte Objective."
      : "",
    keyResultId
      ? "Wenn es sinnvoll ist, liefere zusaetzlich keyResultRewrite (Titel + optional targetValue/unit) fuer das fokussierte Key Result."
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
    .filter((item): item is { role: "user" | "assistant"; content: string } => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as { role?: unknown; content?: unknown };
      return (
        (candidate.role === "user" || candidate.role === "assistant") &&
        typeof candidate.content === "string"
      );
    })
    .slice(-6)
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
    actions.push({ type: "SAVE_NEXT_ACTION", label: "Naechste Aktion speichern" });
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
