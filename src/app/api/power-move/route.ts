import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedViewer } from "@/lib/active-couple";
import { RateLimitError, assertRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { generateChatCompletion, generateToolCallCompletion, type LlmMessage } from "@/lib/llm";
import { calculateKeyResultProgress } from "@/lib/key-results";
import { calculateProgress } from "@/lib/progress";
import { formatProgressPercent } from "@/lib/progress";
import {
  buildKnowledgeContext,
  buildCoupleContext,
  extractMiniRitualCandidates,
  formatThinkingPartnerResponse,
  inferTopicsFromQuery,
  searchTranscriptChunks,
} from "@/lib/thinking-partner";
import type { ThinkingPartnerAction } from "@/lib/thinking-partner-types";
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

function diffDays(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function safeAverage(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

  const parsedBody = bodySchema.safeParse(requestBody);
  const quarterId = parsedBody.success ? parsedBody.data.quarterId ?? null : null;

  const couple = await prisma.couple.findUnique({
    where: { id: viewer.activeCoupleId },
    select: {
      id: true,
      name: true,
      vision: true,
      mission: true,
      checkInWeekday: true,
      checkInTime: true,
      checkInDurationMinutes: true,
      checkInTimeZone: true,
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
      action: "power_move_request",
      key: viewer.activeCoupleId,
      limit: 8,
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

  const now = new Date();
  const selectedQuarter =
    (quarterId
      ? await prisma.quarter.findFirst({
          where: { id: quarterId, coupleId: viewer.activeCoupleId },
        })
      : await prisma.quarter.findFirst({
          where: {
            coupleId: viewer.activeCoupleId,
            startsAt: { lte: now },
            endsAt: { gte: now },
          },
          orderBy: { startsAt: "desc" },
        })) ??
    (await prisma.quarter.findFirst({
      where: { coupleId: viewer.activeCoupleId },
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
      coupleId: viewer.activeCoupleId,
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
    couple.checkInWeekday &&
      couple.checkInTime &&
      couple.checkInDurationMinutes
  );

  const objectiveSignals = objectives.map((objective) => {
    const progress = calculateProgress(
      objective.keyResults.map((kr) => ({
        currentValue: kr.currentValue,
        targetValue: kr.targetValue,
        startValue: kr.startValue,
        type: kr.type,
        direction: kr.direction,
        redThreshold: kr.redThreshold,
        yellowThreshold: kr.yellowThreshold,
        greenThreshold: kr.greenThreshold,
      }))
    );

    const keyResults = objective.keyResults.map((kr) => {
      const krProgress = calculateKeyResultProgress(kr);
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

  const coupleContext = buildCoupleContext({
    name: couple.name,
    vision: couple.vision,
    mission: couple.mission,
    objectives: objectives.map((objective) => ({
      title: objective.title,
      description: objective.description ?? null,
      nextAction: objective.nextAction ?? null,
      quarter: { title: selectedQuarter.title },
      keyResults: objective.keyResults.map((kr) => ({
        title: kr.title,
        currentValue: kr.currentValue,
        targetValue: kr.targetValue,
        unit: kr.unit ?? null,
      })),
    })),
    commitments: couple.commitments,
    checkInSessions: couple.checkInSessions,
  });

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
  const urgencyFactor = clamp(elapsedDays / quarterTotalDays, 0, 1);

  const prioritizedCandidates = objectiveSignals
    .flatMap((objective) =>
      objective.keyResults.map((kr) => {
        const progressGapScore = (100 - kr.progress) * 0.55;
        const staleScore =
          kr.daysSinceUpdate === null ? 18 : clamp(kr.daysSinceUpdate * 1.8, 0, 24);
        const lateQuarterScore = urgencyFactor * 14;
        const missingNextActionScore = objective.nextAction ? 0 : 6;
        const objectiveLagScore = (100 - objective.progress) * 0.12;
        const totalScore = Math.round(
          progressGapScore +
            staleScore +
            lateQuarterScore +
            missingNextActionScore +
            objectiveLagScore
        );

        return {
          objectiveTitle: objective.title,
          keyResultTitle: kr.title,
          progress: kr.progress,
          daysSinceUpdate: kr.daysSinceUpdate,
          totalScore,
          rationale: [
            `${formatProgressPercent(kr.progress)}% Fortschritt`,
            kr.daysSinceUpdate === null
              ? "noch kein Update"
              : `letztes Update vor ${kr.daysSinceUpdate} Tagen`,
            objective.nextAction ? "Objective hat nächste Aktion" : "Objective hat noch keine nächste Aktion",
          ],
        };
      })
    )
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);

  const checkInLine = checkInEnabled
    ? `Check-in: aktiv (${couple.checkInWeekday} / ${couple.checkInTime}, ${couple.checkInDurationMinutes} Min)`
    : "Check-in: nicht geplant";

  const signalLines = [
    `Quartal: ${selectedQuarter.title} (${selectedQuarter.startsAt.toISOString().slice(0, 10)} bis ${selectedQuarter.endsAt.toISOString().slice(0, 10)})`,
    `Zeit: Tag ${elapsedDays}/${quarterTotalDays} (noch ${remainingDays} Tage)`,
    `Objectives: ${objectiveSignals.length}`,
    `Durchschnittlicher Fortschritt: ${formatProgressPercent(averageProgress)}%`,
    checkInLine,
    "",
    "Low-Progress KRs (Hebel):",
    ...lowProgress.map(
      (kr) => `- ${kr.objectiveTitle}: ${kr.title} (${formatProgressPercent(kr.progress)}%)`
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
    "",
    "Heuristisch priorisierte Hebel-Kandidaten:",
    ...prioritizedCandidates.map(
      (candidate, index) =>
        `${index + 1}. ${candidate.objectiveTitle}: ${candidate.keyResultTitle} -> Score ${candidate.totalScore} (${candidate.rationale.join(", ")})`
    ),
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
          return `- ${kr.title}: ${kr.currentValue}/${kr.targetValue}${unit} (${formatProgressPercent(kr.progress)}%)${stale}`;
        })
        .join("\n");

      const nextAction = objective.nextAction
        ? `\nNächste Aktion: ${objective.nextAction}`
        : "";

      return `Objective: ${objective.title} - ${formatProgressPercent(objective.progress)}%${nextAction}\n${krLines}`;
    })
    .join("\n\n");

  const contextPrompt = [
    "Kontext aus dem OKR-Dashboard:",
    coupleContext,
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
  const snippets = await searchTranscriptChunks(
    query,
    6,
    topics,
    viewer.activeCoupleId
  );
  const knowledgeContext = buildKnowledgeContext(snippets);
  const ritualCandidates = extractMiniRitualCandidates(knowledgeContext);

  const systemPrompt = [
    "Du bist ein deutschsprachiger OKR-Coach für Paare.",
    "Du arbeitest in einer integrierten Duo-Stimme: warm, ermutigend, bildhaft und gleichzeitig präzise, strukturierend und pragmatisch.",
    "Erst würdigen, dann schärfen. Erst Beziehung, dann Methode. Lieber Klarheit als Buzzwords.",
    "Objective: Liefere genau EINEN Powermove für die nächsten 7 Tage, der wahrscheinlich den größten Hebel für dieses Quartal hat.",
    "Powermove = eine konkrete Intervention, die man sofort planen kann (<= 15 Minuten Aufwand, low-friction).",
    "Nutze die Daten (Progress, stale KRs, Check-in Status) für deinen Vorschlag.",
    "Bevorzuge die heuristisch priorisierten Hebel-Kandidaten aus dem Kontext, außer ein anderer Schritt ist klar sinnvoller.",
    "Antworte warm, klar, nicht wertend. Kein Therapie-Setting, keine Diagnosen.",
    "Wenn hilfreich, benenne kurz, ob ihr gerade eher bei Vision, Mission, Objective, Key Result oder Alltagssystem festhängt.",
    "WICHTIG: Du MUSST deine Antwort als JSON via Tool-Aufruf liefern (kein Freitext).",
    "Format: summary (1-3 Sätze) -> 2-4 impulses -> nextStep = Powermove (konkret) -> 1-2 questions.",
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
        "Was ist unser sinnvollster nächster Schritt mit großem Hebel für dieses Quartal?",
    },
  ];

  const toolResult = await generateToolCallCompletion(messages, {
    name: "power_move_answer",
    description:
      "Erzeuge genau eine Powermove-Empfehlung des OKR-Coachs für das Quartal als strukturierte Antwort.",
    parameters: toolSchema,
  });

  if (toolResult.error) {
    return NextResponse.json({ error: toolResult.error }, { status: 503 });
  }

  let structured: ThinkingPartnerResponse | null = null;
  let replyText = "";

  if (toolResult.toolArgumentsJson) {
    const parsed = thinkingPartnerResponseSchema.safeParse(
      toolResult.toolArgumentsJson
    );
    if (parsed.success) {
      structured = parsed.data;
      replyText = formatThinkingPartnerResponse(parsed.data, "Powermove");
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

  const actions: ThinkingPartnerAction[] = [
    { type: "OPEN_THINKING_PARTNER", label: "Im OKR-Coach vertiefen" },
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
  });
}
