import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthSession } from "@/auth";
import { prisma } from "@/lib/db";
import { generateChatCompletion, generateToolCallCompletion, type LlmMessage } from "@/lib/llm";
import { calculateProgress } from "@/lib/progress";
import {
  buildKnowledgeContext,
  inferTopicsFromQuery,
  searchTranscriptChunks,
} from "@/lib/thinking-partner";
import {
  thinkingPartnerResponseSchema,
  type ThinkingPartnerResponse,
} from "@/lib/validations/thinking-partner";

const DAY_MS = 24 * 60 * 60 * 1000;

const bodySchema = z
  .object({
    quarterId: z.string().trim().min(1).optional().nullable(),
  })
  .strict();

const toolSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    impulses: {
      type: "array",
      items: { type: "string" },
      minItems: 2,
      maxItems: 4,
    },
    nextStep: { type: "string" },
    questions: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 2,
    },
    miniRitual: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        steps: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 6,
        },
      },
      required: ["title", "steps"],
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
    `Powermove: ${answer.nextStep}`,
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

function diffDays(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function safeAverage(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export async function POST(req: Request) {
  const session = await getAuthSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = bodySchema.safeParse(await req.json().catch(() => ({})));
  const quarterId = parsedBody.success ? parsedBody.data.quarterId ?? null : null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      coupleId: true,
      couple: {
        select: {
          id: true,
          name: true,
          vision: true,
          mission: true,
          checkInWeekday: true,
          checkInTime: true,
          checkInDurationMinutes: true,
          checkInTimeZone: true,
        },
      },
    },
  });

  if (!user?.coupleId || !user.couple) {
    return NextResponse.json({ error: "No couple" }, { status: 404 });
  }

  const now = new Date();
  const selectedQuarter =
    (quarterId
      ? await prisma.quarter.findFirst({
          where: { id: quarterId, coupleId: user.coupleId },
        })
      : await prisma.quarter.findFirst({
          where: {
            coupleId: user.coupleId,
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
          orderBy: { startsAt: "desc" },
        })) ??
    (await prisma.quarter.findFirst({
      where: { coupleId: user.coupleId },
      orderBy: { startsAt: "desc" },
    }));

  if (!selectedQuarter) {
    return NextResponse.json(
      { error: "Kein Quartal gefunden." },
      { status: 404 }
    );
  }

  const objectives = await prisma.objective.findMany({
    where: {
      coupleId: user.coupleId,
      quarterId: selectedQuarter.id,
      archivedAt: null,
    },
    include: {
      keyResults: {
        where: { archivedAt: null },
        include: {
          updates: {
            select: { createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const checkInEnabled = Boolean(
    user.couple.checkInWeekday &&
      user.couple.checkInTime &&
      user.couple.checkInDurationMinutes
  );

  const objectiveSignals = objectives.map((objective) => {
    const progress = calculateProgress(
      objective.keyResults.map((kr) => ({
        currentValue: kr.currentValue,
        targetValue: kr.targetValue,
      }))
    );

    const keyResults = objective.keyResults.map((kr) => {
      const krProgress = kr.targetValue
        ? Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100)
        : 0;
      const lastUpdateAt = kr.updates[0]?.createdAt ?? null;
      const daysSinceUpdate = lastUpdateAt ? diffDays(lastUpdateAt, now) : null;

      return {
        id: kr.id,
        title: kr.title,
        currentValue: kr.currentValue,
        targetValue: kr.targetValue,
        unit: kr.unit,
        progress: krProgress,
        lastUpdateAt,
        daysSinceUpdate,
      };
    });

    const lastUpdateAt = keyResults
      .map((kr) => kr.lastUpdateAt)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    return {
      id: objective.id,
      title: objective.title,
      description: objective.description ?? null,
      nextAction: objective.nextAction ?? null,
      progress,
      lastUpdateAt,
      keyResults,
    };
  });

  const averageProgress = safeAverage(objectiveSignals.map((o) => o.progress));

  const allKeyResults = objectiveSignals.flatMap((objective) =>
    objective.keyResults.map((kr) => ({
      objectiveTitle: objective.title,
      ...kr,
    }))
  );

  const staleKeyResults = allKeyResults
    .filter((kr) => kr.daysSinceUpdate !== null)
    .sort((a, b) => (b.daysSinceUpdate ?? 0) - (a.daysSinceUpdate ?? 0))
    .slice(0, 4);

  const neverUpdated = allKeyResults
    .filter((kr) => kr.daysSinceUpdate === null)
    .slice(0, 4);

  const lowProgress = [...allKeyResults]
    .sort((a, b) => a.progress - b.progress)
    .slice(0, 4);

  const quarterTotalDays =
    Math.max(
      1,
      Math.ceil(
        (selectedQuarter.endsAt.getTime() - selectedQuarter.startsAt.getTime()) /
          DAY_MS
      )
    ) + 1;
  const elapsedDays = Math.max(
    0,
    Math.min(quarterTotalDays, diffDays(selectedQuarter.startsAt, now) + 1)
  );
  const remainingDays = Math.max(0, quarterTotalDays - elapsedDays);

  const checkInLine = checkInEnabled
    ? `Check-in: aktiv (${user.couple.checkInWeekday} / ${user.couple.checkInTime}, ${user.couple.checkInDurationMinutes} Min)`
    : "Check-in: nicht geplant";

  const signalLines = [
    `Quartal: ${selectedQuarter.title} (${selectedQuarter.startsAt.toISOString().slice(0, 10)} bis ${selectedQuarter.endsAt.toISOString().slice(0, 10)})`,
    `Zeit: Tag ${elapsedDays}/${quarterTotalDays} (noch ${remainingDays} Tage)`,
    `Objectives: ${objectiveSignals.length}`,
    `Durchschnittlicher Fortschritt: ${averageProgress}%`,
    checkInLine,
    "",
    "Low-Progress KRs (Hebel):",
    ...lowProgress.map(
      (kr) => `- ${kr.objectiveTitle}: ${kr.title} (${kr.progress}%)`
    ),
    "",
    "Stale KRs (Momentum):",
    ...staleKeyResults.map(
      (kr) =>
        `- ${kr.objectiveTitle}: ${kr.title} (letztes Update vor ${kr.daysSinceUpdate} Tagen)`
    ),
    ...(!staleKeyResults.length && neverUpdated.length
      ? neverUpdated.map(
          (kr) => `- ${kr.objectiveTitle}: ${kr.title} (noch kein Update)`
        )
      : []),
  ].join("\n");

  const objectiveLines = objectiveSignals
    .map((objective) => {
      const krLines = objective.keyResults
        .map((kr) => {
          const unit = kr.unit ? ` ${kr.unit}` : "";
          const stale =
            kr.daysSinceUpdate === null
              ? " (noch kein Update)"
              : kr.daysSinceUpdate >= 7
                ? ` (stale: ${kr.daysSinceUpdate} Tage)`
                : "";
          return `- ${kr.title}: ${kr.currentValue}/${kr.targetValue}${unit} (${kr.progress}%)${stale}`;
        })
        .join("\n");

      const nextAction = objective.nextAction
        ? `\nNaechste Aktion: ${objective.nextAction}`
        : "";

      return `Objective: ${objective.title} - ${objective.progress}%${nextAction}\n${krLines}`;
    })
    .join("\n\n");

  const contextPrompt = [
    "Kontext aus dem OKR-Dashboard:",
    `Couple: ${user.couple.name}`,
    user.couple.vision ? `Vision: ${user.couple.vision}` : "Vision: (nicht gesetzt)",
    user.couple.mission ? `Mission: ${user.couple.mission}` : "Mission: (nicht gesetzt)",
    "",
    signalLines,
    "",
    "Details:",
    objectiveLines || "(keine Objectives)",
  ].join("\n");

  const query =
    !checkInEnabled || objectiveSignals.length >= 3
      ? "Weekly Check-in Struktur 15 Minuten"
      : "KR-Check in 90 Sekunden";
  const topics = inferTopicsFromQuery(query);
  const snippets = await searchTranscriptChunks(query, 6, topics);
  const knowledgeContext = buildKnowledgeContext(snippets);
  const ritualCandidates = extractMiniRitualCandidates(knowledgeContext);

  const systemPrompt = [
    "Du bist ein Thinking Partner fuer Paare (OKR fuer Paare).",
    "Ziel: Liefere genau EINEN Powermove, der in den naechsten 7 Tagen den groessten Hebel fuer dieses Quartal hat.",
    "Powermove = eine konkrete Intervention, die man sofort planen kann (<= 15 Minuten Aufwand, low-friction).",
    "Nutze die Daten (Progress, stale KRs, Check-in Status) fuer deinen Vorschlag.",
    "Antworte warm, klar, nicht wertend. Kein Therapie-Setting, keine Diagnosen.",
    "WICHTIG: Du MUSST deine Antwort als JSON via Tool-Aufruf liefern (kein Freitext).",
    "Format: summary (1-3 Saetze) -> 2-4 impulses -> nextStep = Powermove (konkret) -> 1-2 questions.",
    ritualCandidates.length
      ? "Wenn sinnvoll: schlage 1 Mini-Ritual vor (kurz), bevorzugt basierend auf den Call-Snippets."
      : "Mini-Ritual optional, wenn es ohne Snippets sinnvoll ist.",
  ].join("\n");

  const ritualPrompt = ritualCandidates.length
    ? `Mini-Ritual Kandidaten (aus Calls, du darfst einen adaptieren):\n- ${ritualCandidates.join(
        "\n- "
      )}`
    : "Keine Mini-Ritual Kandidaten gefunden.";

  const messages: LlmMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: contextPrompt },
    { role: "system", content: `Wissensbasis aus Coaching-Calls:\n${knowledgeContext}` },
    { role: "system", content: ritualPrompt },
    {
      role: "user",
      content:
        "Was ist unser EIN Powermove (groesster Hebel) fuer dieses Quartal?",
    },
  ];

  const toolResult = await generateToolCallCompletion(messages, {
    name: "power_move_answer",
    description:
      "Erzeuge genau eine powermove Empfehlung fuer das Quartal als strukturierte Antwort.",
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

  const actions: Array<{ type: string; label: string }> = [
    { type: "OPEN_THINKING_PARTNER", label: "Im Thinking Partner vertiefen" },
  ];

  const combinedText = structured
    ? `${structured.summary}\n${structured.nextStep}\n${structured.impulses.join(
        " "
      )}`
    : replyText;

  if (/(check[- ]?in|wochencheck|kalender|termin)/i.test(combinedText)) {
    actions.unshift({ type: "OPEN_CHECKIN_SETTINGS", label: "Check-in planen" });
  }

  return NextResponse.json({
    quarter: {
      id: selectedQuarter.id,
      title: selectedQuarter.title,
    },
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

