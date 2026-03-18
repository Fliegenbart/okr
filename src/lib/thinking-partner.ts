import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { calculateProgress } from "@/lib/progress";

export type TranscriptSnippet = {
  id: string;
  content: string;
  title: string;
  sourcePath: string | null;
  topics?: unknown;
};

export const transcriptTopics = [
  "KONFLIKT",
  "PRIORISIERUNG",
  "INTIMITAET",
  "FINANZEN",
] as const;

export type TranscriptTopic = (typeof transcriptTopics)[number];

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
) {
  if (!query.trim()) return [];

  const topicsList = (topics ?? []).filter((topic): topic is TranscriptTopic =>
    transcriptTopics.includes(topic)
  );

  const runQuery = async (topicsFilter: TranscriptTopic[]) => {
    const topicConditions = topicsFilter.length
      ? Prisma.sql`AND (${Prisma.join(
          topicsFilter.map(
            (topic) =>
              Prisma.sql`coalesce(t.topics, '[]'::jsonb) ? ${topic}`
          ),
          " OR "
        )})`
      : Prisma.empty;

    const transcriptScopeCondition = coupleId
      ? Prisma.sql`AND (t."coupleId" IS NULL OR t."coupleId" = ${coupleId})`
      : Prisma.sql`AND t."coupleId" IS NULL`;

    return prisma.$queryRaw<
      Array<{
        id: string;
        content: string;
        title: string;
        sourcePath: string | null;
        topics: unknown;
      }>
    >(Prisma.sql`
      SELECT tc.id,
             tc.content,
             t.title,
             t."sourcePath",
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
    return runQuery([]);
  }

  return results;
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
      }))
    );

    const keyResults = objective.keyResults
      .map((keyResult) => {
        const unit = keyResult.unit ? ` ${keyResult.unit}` : "";
        return `- ${keyResult.title}: ${keyResult.currentValue}/${keyResult.targetValue}${unit}`;
      })
      .join("\n");

    const nextAction = objective.nextAction
      ? `\nNächste Aktion: ${objective.nextAction}`
      : "";

    return `Objective: ${objective.title} (${objective.quarter.title}) - ${progress}%${nextAction}\n${keyResults}`;
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
  }\n\nLetzte Check-ins:\n${
    checkIns?.length ? checkIns.join("\n\n") : "(keine Check-ins)"
  }`;
}

export function buildKnowledgeContext(snippets: TranscriptSnippet[]) {
  if (!snippets.length) return "Keine passenden Ausschnitte gefunden.";
  return snippets
    .map((snippet, index) => {
      return `Quelle ${index + 1} (${snippet.title}): ${snippet.content}`;
    })
    .join("\n\n");
}
