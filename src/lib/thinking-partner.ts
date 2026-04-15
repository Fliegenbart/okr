import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { calculateProgress, formatProgressPercent } from "@/lib/progress";
import type { ThinkingPartnerResponse } from "@/lib/validations/thinking-partner";
import {
  getPersonaLabel,
  getTranscriptSpeakerLabel,
  type PersonaProfileSnapshot,
  type PersonaSpeaker,
} from "@/lib/transcript-persona";

const STYLE_QUALITY_STATUSES = ["VERIFIED", "INFERRED"] as const;

export const transcriptTopics = ["KONFLIKT", "PRIORISIERUNG", "INTIMITAET", "FINANZEN"] as const;

export type TranscriptTopic = (typeof transcriptTopics)[number];

export type TranscriptSnippet = {
  id: string;
  content: string;
  title: string;
  sourcePath: string | null;
  sessionDate: Date | null;
  speaker: string | null;
  qualityStatus: string | null;
  topics: TranscriptTopic[] | null;
};

type TranscriptSnippetRow = {
  id: string;
  content: string;
  title: string;
  sourcePath: string | null;
  sessionDate: Date | null;
  speaker: string | null;
  qualityStatus: string | null;
  topics: Prisma.JsonValue | null;
};

export function inferTopicsFromQuery(query: string): TranscriptTopic[] {
  const lower = query.toLowerCase();
  const topics = new Set<TranscriptTopic>();

  if (/(konflikt|streit|eskal|repair|wut|vorwurf|trigger)/.test(lower)) {
    topics.add("KONFLIKT");
  }
  if (/(prioris|zu viele|punkte|streit.*ziel|nicht-jetzt)/.test(lower)) {
    topics.add("PRIORISIERUNG");
  }
  if (/(intim|naehe|sexual|sex|beruehr|druck)/.test(lower)) {
    topics.add("INTIMITAET");
  }
  if (/(finanz|geld|money|budget|konto|schulden)/.test(lower)) {
    topics.add("FINANZEN");
  }

  return Array.from(topics);
}

export async function searchTranscriptChunks(
  query: string,
  limit = 6,
  topics?: TranscriptTopic[],
  coupleId?: string | null
): Promise<TranscriptSnippet[]> {
  if (!query.trim()) return [];

  const topicsList = (topics ?? []).filter((topic): topic is TranscriptTopic =>
    transcriptTopics.includes(topic)
  );

  const runQuery = async (topicsFilter: TranscriptTopic[]) => {
    const topicConditions = topicsFilter.length
      ? Prisma.sql`AND (${Prisma.join(
          topicsFilter.map((topic) => Prisma.sql`coalesce(t.topics, '[]'::jsonb) ? ${topic}`),
          " OR "
        )})`
      : Prisma.empty;

    const transcriptScopeCondition = coupleId
      ? Prisma.sql`AND (t."coupleId" IS NULL OR t."coupleId" = ${coupleId})`
      : Prisma.sql`AND t."coupleId" IS NULL`;

    return prisma.$queryRaw<TranscriptSnippetRow[]>(Prisma.sql`
      SELECT tc.id,
             tc.content,
             t.title,
             t."sourcePath",
             t."sessionDate",
             tc."speaker"::text AS speaker,
             tc."qualityStatus"::text AS "qualityStatus",
             t.topics
      FROM "TranscriptChunk" tc
      JOIN "Transcript" t ON t.id = tc."transcriptId"
      WHERE to_tsvector('german', tc.content) @@ plainto_tsquery('german', ${query})
      ${transcriptScopeCondition}
      ${topicConditions}
      ORDER BY ts_rank(to_tsvector('german', tc.content), plainto_tsquery('german', ${query})) DESC
      LIMIT ${limit}
    `);
  };

  const results = await runQuery(topicsList);

  if (topicsList.length && results.length === 0) {
    return runQuery([]).then((rows) =>
      rows.map((row) => ({
        ...row,
        topics: parseTranscriptTopics(row.topics),
      }))
    );
  }

  return results.map((row) => ({
    ...row,
    topics: parseTranscriptTopics(row.topics),
  }));
}

export async function searchPersonaStyleChunks(
  query: string,
  speaker: PersonaSpeaker,
  limit = 4,
  topics?: TranscriptTopic[],
  coupleId?: string | null
): Promise<TranscriptSnippet[]> {
  if (!query.trim()) return [];

  const topicsList = (topics ?? []).filter((topic): topic is TranscriptTopic =>
    transcriptTopics.includes(topic)
  );

  const transcriptScopeCondition = coupleId
    ? Prisma.sql`AND (t."coupleId" IS NULL OR t."coupleId" = ${coupleId})`
    : Prisma.sql`AND t."coupleId" IS NULL`;

  const qualityCondition = Prisma.sql`AND tc."qualityStatus"::text IN (${Prisma.join(
    STYLE_QUALITY_STATUSES.map((status) => Prisma.sql`${status}`)
  )})`;

  const speakerCondition = Prisma.sql`AND tc."speaker"::text = ${speaker}`;

  const runQuery = async (topicsFilter: TranscriptTopic[]) => {
    const topicConditions = topicsFilter.length
      ? Prisma.sql`AND (${Prisma.join(
          topicsFilter.map((topic) => Prisma.sql`coalesce(t.topics, '[]'::jsonb) ? ${topic}`),
          " OR "
        )})`
      : Prisma.empty;

    return prisma.$queryRaw<TranscriptSnippetRow[]>(Prisma.sql`
      SELECT tc.id,
             tc.content,
             t.title,
             t."sourcePath",
             t."sessionDate",
             tc."speaker"::text AS speaker,
             tc."qualityStatus"::text AS "qualityStatus",
             t.topics
      FROM "TranscriptChunk" tc
      JOIN "Transcript" t ON t.id = tc."transcriptId"
      WHERE to_tsvector('german', tc.content) @@ plainto_tsquery('german', ${query})
      ${transcriptScopeCondition}
      ${speakerCondition}
      ${qualityCondition}
      ${topicConditions}
      ORDER BY ts_rank(to_tsvector('german', tc.content), plainto_tsquery('german', ${query})) DESC
      LIMIT ${limit}
    `);
  };

  const topicalResults = await runQuery(topicsList);

  if (topicalResults.length) {
    return topicalResults.map((row) => ({
      ...row,
      topics: parseTranscriptTopics(row.topics),
    }));
  }

  const genericResults = topicsList.length ? await runQuery([]) : [];

  if (genericResults.length) {
    return genericResults.map((row) => ({
      ...row,
      topics: parseTranscriptTopics(row.topics),
    }));
  }

  return prisma.transcriptChunk
    .findMany({
      where: {
        speaker,
        qualityStatus: { in: [...STYLE_QUALITY_STATUSES] },
        transcript: coupleId ? { OR: [{ coupleId: null }, { coupleId }] } : { coupleId: null },
      },
      select: {
        id: true,
        content: true,
        qualityStatus: true,
        transcript: {
          select: {
            title: true,
            sourcePath: true,
            sessionDate: true,
            topics: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    })
    .then((rows) =>
      rows.map((row) => ({
        id: row.id,
        content: row.content,
        title: row.transcript.title,
        sourcePath: row.transcript.sourcePath,
        sessionDate: row.transcript.sessionDate,
        speaker,
        qualityStatus: row.qualityStatus,
        topics: parseTranscriptTopics(row.transcript.topics),
      }))
    );
}

function parseTranscriptTopics(
  value: Prisma.JsonValue | null
): TranscriptTopic[] | null {
  if (!Array.isArray(value)) return null;

  const topics = value.filter(
    (item): item is TranscriptTopic =>
      typeof item === "string" && transcriptTopics.includes(item as TranscriptTopic)
  );

  return topics.length ? topics : null;
}

function parseStringList(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getPersonaProfile(
  speaker: PersonaSpeaker,
  coupleId?: string | null
): Promise<PersonaProfileSnapshot | null> {
  const scopeKey = coupleId ?? "global";

  const profile =
    (await prisma.transcriptPersonaProfile.findUnique({
      where: {
        scopeKey_speaker: {
          scopeKey,
          speaker,
        },
      },
      select: {
        styleSummary: true,
        toneDescriptors: true,
        recurringPhrases: true,
        vocabulary: true,
        avoidPatterns: true,
        sampleCount: true,
      },
    })) ??
    (coupleId
      ? await prisma.transcriptPersonaProfile.findUnique({
          where: {
            scopeKey_speaker: {
              scopeKey: "global",
              speaker,
            },
          },
          select: {
            styleSummary: true,
            toneDescriptors: true,
            recurringPhrases: true,
            vocabulary: true,
            avoidPatterns: true,
            sampleCount: true,
          },
        })
      : null);

  if (!profile) {
    return null;
  }

  return {
    styleSummary: profile.styleSummary,
    toneDescriptors: parseStringList(profile.toneDescriptors),
    recurringPhrases: parseStringList(profile.recurringPhrases),
    vocabulary: parseStringList(profile.vocabulary),
    avoidPatterns: parseStringList(profile.avoidPatterns),
    sampleCount: profile.sampleCount,
  };
}

export function buildCoupleContext(couple: {
  name: string;
  vision: string | null;
  mission: string | null;
  objectives: Array<{
    title: string;
    description: string | null;
    nextAction?: string | null;
    quarter: { title: string };
    keyResults: Array<{
      title: string;
      currentValue: number;
      targetValue: number;
      unit: string | null;
    }>;
  }>;
  commitments?: Array<{
    title: string;
    details: string | null;
    dueAt: Date | null;
    status: string;
    owner?: { name: string | null; email: string | null } | null;
    objective?: { title: string } | null;
  }>;
  checkInSessions?: Array<{
    title: string;
    summary: string | null;
    moodRating: number | null;
    createdAt: Date;
  }>;
}) {
  const vision = couple.vision ? couple.vision : "(nicht gesetzt)";
  const mission = couple.mission ? couple.mission : "(nicht gesetzt)";

  const objectives = couple.objectives.map((objective) => {
    const progress = calculateProgress(
      objective.keyResults.map((keyResult) => ({
        currentValue: keyResult.currentValue,
        targetValue: keyResult.targetValue,
        startValue: (keyResult as { startValue?: number }).startValue,
        type: (keyResult as { type?: "INCREASE_TO" | "STAY_ABOVE" | "STAY_BELOW" | "BINARY" | "TRAFFIC_LIGHT" }).type,
        direction: (keyResult as { direction?: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER" }).direction,
        redThreshold: (keyResult as { redThreshold?: number | null }).redThreshold,
        yellowThreshold: (keyResult as { yellowThreshold?: number | null }).yellowThreshold,
        greenThreshold: (keyResult as { greenThreshold?: number | null }).greenThreshold,
      }))
    );

    const keyResults = objective.keyResults
      .map((keyResult) => {
        const unit = keyResult.unit ? ` ${keyResult.unit}` : "";
        return `- ${keyResult.title}: ${keyResult.currentValue}/${keyResult.targetValue}${unit}`;
      })
      .join("\n");

    const nextAction = objective.nextAction ? `\nNächste Aktion: ${objective.nextAction}` : "";

    return `Objective: ${objective.title} (${objective.quarter.title}) - ${formatProgressPercent(progress)}%${nextAction}\n${keyResults}`;
  });

  const commitments = couple.commitments?.map((commitment) => {
    const owner = commitment.owner
      ? `, Owner: ${commitment.owner.name ?? commitment.owner.email ?? "unbekannt"}`
      : "";
    const dueAt = commitment.dueAt ? `, Fällig: ${commitment.dueAt.toISOString()}` : "";
    const objective = commitment.objective ? `, Objective: ${commitment.objective.title}` : "";
    return `Commitment: ${commitment.title} (${commitment.status}${dueAt}${owner}${objective})${
      commitment.details ? `\nDetails: ${commitment.details}` : ""
    }`;
  });

  const checkIns = couple.checkInSessions?.map((checkIn) => {
    const mood = checkIn.moodRating ? `, Mood: ${checkIn.moodRating}/5` : "";
    return `Check-in: ${checkIn.title} (${checkIn.createdAt.toISOString()}${mood})${
      checkIn.summary ? `\nSummary: ${checkIn.summary}` : ""
    }`;
  });

  return `Couple: ${couple.name}\nVision: ${vision}\nMission: ${mission}\n\nObjectives:\n${
    objectives.length ? objectives.join("\n\n") : "(keine Objectives)"
  }\n\nCommitments:\n${
    commitments?.length ? commitments.join("\n\n") : "(keine Commitments)"
  }\n\nLetzte Check-ins:\n${checkIns?.length ? checkIns.join("\n\n") : "(keine Check-ins)"}`;
}

export function buildKnowledgeContext(snippets: TranscriptSnippet[]) {
  if (!snippets.length) return "Keine passenden Ausschnitte gefunden.";
  return snippets
    .map((snippet, index) => {
      const speaker = getTranscriptSpeakerLabel(snippet.speaker);
      const date = snippet.sessionDate
        ? new Intl.DateTimeFormat("de-DE", {
            dateStyle: "medium",
          }).format(new Date(snippet.sessionDate))
        : null;
      const meta = [speaker, date].filter(Boolean).join(", ");
      const metaSuffix = meta ? `, ${meta}` : "";
      return `Quelle ${index + 1} (${snippet.title}${metaSuffix}): ${snippet.content}`;
    })
    .join("\n\n");
}

export function extractMiniRitualCandidates(text: string) {
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

export function formatThinkingPartnerResponse(
  answer: ThinkingPartnerResponse,
  nextStepLabel = "Nächster Schritt"
) {
  const lines = [
    answer.summary,
    "",
    "Impulse:",
    ...answer.impulses.map((item) => `- ${item}`),
    "",
    `${nextStepLabel}: ${answer.nextStep}`,
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

export function buildPersonaContext({
  speaker,
  profile,
  styleSnippets,
}: {
  speaker: PersonaSpeaker;
  profile: PersonaProfileSnapshot | null;
  styleSnippets: TranscriptSnippet[];
}) {
  const speakerLabel = getPersonaLabel(speaker);
  const toneDescriptors = profile?.toneDescriptors.length
    ? profile.toneDescriptors.join(", ")
    : "klar, warm, handlungsorientiert";
  const recurringPhrases = profile?.recurringPhrases.length
    ? profile.recurringPhrases.slice(0, 4).join("; ")
    : "keine stabilen Wiederholungen gefunden";
  const vocabulary = profile?.vocabulary.length
    ? profile.vocabulary.slice(0, 8).join(", ")
    : "keine stabilen Signalwörter gefunden";
  const avoidPatterns = profile?.avoidPatterns.length
    ? profile.avoidPatterns.join(" | ")
    : "Keine Diagnosen, keine erfundenen Erinnerungen.";
  const styleExamples = styleSnippets.length
    ? styleSnippets
        .map((snippet, index) => `Stilbeispiel ${index + 1}: ${snippet.content.slice(0, 260)}`)
        .join("\n")
    : "Keine Stilbeispiele gefunden.";

  return [
    `Gewählte Persona: ${speakerLabel}`,
    `Profil: ${profile?.styleSummary ?? "Kein gespeichertes Persona-Profil gefunden."}`,
    `Ton: ${toneDescriptors}`,
    `Typische Wörter: ${vocabulary}`,
    `Wiederkehrende Formulierungen: ${recurringPhrases}`,
    `No-Gos: ${avoidPatterns}`,
    "",
    "Wichtige Regel: Du formulierst im Stil dieser Persona, gibst dich aber nicht als reale Person mit eigenen privaten Erinnerungen aus.",
    "Nutze keine Ich-Erlebnisse, wenn sie nicht direkt durch den Kontext gedeckt sind.",
    "",
    styleExamples,
  ].join("\n");
}
