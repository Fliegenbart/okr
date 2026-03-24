/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const mammoth = require("mammoth");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".srt", ".vtt", ".docx"]);
const MAX_CHARS = Number(process.env.TRANSCRIPT_CHUNK_SIZE || 1200);
const OVERLAP = Number(process.env.TRANSCRIPT_CHUNK_OVERLAP || 200);
const PERSONA_SPEAKERS = ["DANIEL", "CHRISTIANE"];
const STYLE_ELIGIBLE_QUALITY = new Set(["VERIFIED", "INFERRED"]);
const GENERIC_AVOID_PATTERNS = [
  "Keine Diagnosen oder Therapie-Sprache.",
  "Keine erfundenen privaten Erinnerungen oder Insider-Geschichten.",
  "Keine harte, belehrende oder abwertende Sprache.",
];
const NON_SPEAKER_HEADINGS = new Set([
  "title",
  "date",
  "participants",
  "objective",
  "objectives",
  "key result",
  "key results",
  "kr",
  "krs",
  "mikro ritual",
  "mini ritual",
  "ritual",
  "vorschlag",
  "risiko",
  "beispiel",
  "schritt",
  "schritte",
  "input",
  "output",
  "outcome",
]);

const STOPWORDS = new Set([
  "aber",
  "alle",
  "alles",
  "also",
  "als",
  "am",
  "an",
  "auch",
  "auf",
  "aus",
  "bei",
  "beim",
  "bin",
  "bis",
  "da",
  "damit",
  "dann",
  "das",
  "dass",
  "den",
  "der",
  "des",
  "die",
  "dies",
  "diese",
  "dieser",
  "doch",
  "du",
  "durch",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "euch",
  "euer",
  "eure",
  "fuer",
  "ganz",
  "genau",
  "geht",
  "gerade",
  "habt",
  "hat",
  "hier",
  "ich",
  "ihr",
  "ihre",
  "im",
  "in",
  "ist",
  "ja",
  "jede",
  "jeder",
  "jetzt",
  "kein",
  "keine",
  "koennt",
  "koennen",
  "kommt",
  "mal",
  "mehr",
  "mit",
  "nach",
  "nicht",
  "noch",
  "nur",
  "oder",
  "schon",
  "seid",
  "sein",
  "seine",
  "sich",
  "sie",
  "sind",
  "so",
  "ueber",
  "um",
  "und",
  "uns",
  "unser",
  "unsere",
  "vom",
  "von",
  "vor",
  "wenn",
  "werdet",
  "wie",
  "wir",
  "wird",
  "wo",
  "wollt",
  "zu",
  "zum",
  "zur",
]);

function inferTopicsFromTitle(title) {
  const lower = title.toLowerCase();
  const topics = new Set();

  if (/(konflikt|streit|repair|eskal)/.test(lower)) topics.add("KONFLIKT");
  if (/(prioris|zu viele|punkte|nicht-jetzt)/.test(lower)) topics.add("PRIORISIERUNG");
  if (/(intim|naehe|sexual|beruehr)/.test(lower)) topics.add("INTIMITAET");
  if (/(finanz|geld|money)/.test(lower)) topics.add("FINANZEN");

  return Array.from(topics);
}

async function readTranscriptContent(filePath, ext) {
  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }

  return fs.readFileSync(filePath, "utf8");
}

function normalizeText(content, ext) {
  const normalized = content.replace(/\uFEFF/g, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  if (ext === ".srt" || ext === ".vtt") {
    return lines
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        if (trimmed === "WEBVTT") return false;
        if (/^\d+$/.test(trimmed)) return false;
        if (trimmed.includes("-->")) return false;
        return true;
      })
      .join("\n");
  }

  return normalized;
}

function normalizeWhitespace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function inferDateFromFileName(filePath) {
  const match = path.basename(filePath).match(/(\d{4}-\d{2}-\d{2})/);
  return match ? parseSessionDate(match[1]) : null;
}

function parseSessionDate(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00.000Z`);
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function extractMetadata(normalizedContent, filePath, ext) {
  const defaultTitle = path
    .basename(filePath, ext)
    .replace(/^\d{4}-\d{2}-\d{2}[_-]?/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  const lines = normalizedContent.split("\n");
  const bodyLines = [];
  let title = defaultTitle || path.basename(filePath, ext);
  let sessionDate = inferDateFromFileName(filePath);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (!trimmed) {
      bodyLines.push("");
      continue;
    }

    const titleMatch = trimmed.match(/^Title:\s*(.+)$/i);
    if (titleMatch) {
      title = normalizeWhitespace(titleMatch[1]);
      continue;
    }

    const dateMatch = trimmed.match(/^Date:\s*(.+)$/i);
    if (dateMatch) {
      const parsedDate = parseSessionDate(dateMatch[1]);
      if (parsedDate) {
        sessionDate = parsedDate;
      }
      continue;
    }

    if (/^Participants:\s*/i.test(trimmed)) {
      continue;
    }

    bodyLines.push(rawLine);
  }

  return {
    title,
    sessionDate,
    body: bodyLines.join("\n").trim(),
  };
}

function stripCuePrefix(line) {
  return normalizeWhitespace(
    line
      .replace(/^\[[0-9:.]+\]\s*/, "")
      .replace(/^[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*/, "")
      .replace(/^-\s+/, "")
  );
}

function mapSpeakerLabel(rawLabel) {
  const normalized = normalizeWhitespace(
    rawLabel
      .toLowerCase()
      .replace(/[()[\],.]/g, " ")
      .replace(/\s+/g, " ")
  );

  if (!normalized) {
    return { speaker: "UNKNOWN", qualityStatus: "UNKNOWN" };
  }

  const hasDaniel = /\bdaniel\b/.test(normalized);
  const hasChristiane = /\bchristiane\b/.test(normalized);

  if ((hasDaniel && hasChristiane) || /\bbeide\b/.test(normalized)) {
    return { speaker: "MIXED", qualityStatus: "MIXED" };
  }

  if (hasDaniel) {
    return { speaker: "DANIEL", qualityStatus: "VERIFIED" };
  }

  if (hasChristiane) {
    return { speaker: "CHRISTIANE", qualityStatus: "VERIFIED" };
  }

  if (
    /(coach|frage|paar|teilnehmer|participant|moderator|host|sprecher|speaker)/.test(normalized)
  ) {
    return { speaker: "OTHER", qualityStatus: "VERIFIED" };
  }

  return { speaker: "OTHER", qualityStatus: "INFERRED" };
}

function detectSpeakerLine(line) {
  const match = line.match(/^([A-Za-zÄÖÜäöüß/&+ ]{2,50})\s*[:\-–]\s*(.+)$/);
  if (!match) return null;

  const speakerLabel = normalizeWhitespace(match[1]);
  const content = normalizeWhitespace(match[2]);
  const normalizedLabel = speakerLabel
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z/&+ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!speakerLabel || !content || NON_SPEAKER_HEADINGS.has(normalizedLabel)) {
    return null;
  }

  return {
    ...mapSpeakerLabel(speakerLabel),
    speakerLabel,
    content,
  };
}

function mergeSegments(segments) {
  const merged = [];

  for (const segment of segments) {
    const previous = merged[merged.length - 1];

    if (
      previous &&
      previous.speaker === segment.speaker &&
      previous.qualityStatus === segment.qualityStatus
    ) {
      previous.content = normalizeWhitespace(`${previous.content} ${segment.content}`);
      continue;
    }

    merged.push({ ...segment });
  }

  return merged;
}

function splitIntoSpeakerSegments(body) {
  if (!body.trim()) return [];

  const rawLines = body.split("\n");
  const segments = [];
  let current = null;

  const flush = () => {
    if (!current) return;

    const content = normalizeWhitespace(current.parts.join(" "));
    if (content) {
      segments.push({
        speaker: current.speaker,
        qualityStatus: current.qualityStatus,
        speakerLabel: current.speakerLabel,
        content,
      });
    }

    current = null;
  };

  for (const rawLine of rawLines) {
    const cleanedLine = stripCuePrefix(rawLine);
    if (!cleanedLine) {
      continue;
    }

    const detectedSpeaker = detectSpeakerLine(cleanedLine);

    if (detectedSpeaker) {
      flush();
      current = {
        speaker: detectedSpeaker.speaker,
        qualityStatus: detectedSpeaker.qualityStatus,
        speakerLabel: detectedSpeaker.speakerLabel,
        parts: [detectedSpeaker.content],
      };
      continue;
    }

    if (!current) {
      current = {
        speaker: "UNKNOWN",
        qualityStatus: "UNKNOWN",
        speakerLabel: null,
        parts: [cleanedLine],
      };
      continue;
    }

    current.parts.push(cleanedLine);
  }

  flush();

  return mergeSegments(segments);
}

function splitIntoChunks(text, maxChars, overlap) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  const chunks = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + maxChars, clean.length);
    let slice = clean.slice(start, end);

    if (end < clean.length) {
      const lastBreak = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! ")
      );
      const lastSpace = slice.lastIndexOf(" ");
      const cutoff =
        lastBreak > maxChars * 0.6
          ? lastBreak + 1
          : lastSpace > maxChars * 0.6
            ? lastSpace
            : slice.length;
      end = start + cutoff;
      slice = clean.slice(start, end);
    }

    const chunk = slice.trim();
    if (chunk) chunks.push(chunk);

    if (end >= clean.length) break;
    start = Math.max(end - overlap, 0);
  }

  return chunks;
}

function collectFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (SUPPORTED_EXTENSIONS.has(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

function tokenize(text) {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[a-zA-Zäöüß]{3,}/g) || []
  );
}

function countTopWords(chunks, limit = 10) {
  const counts = new Map();

  for (const chunk of chunks) {
    for (const word of tokenize(chunk)) {
      if (STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([word]) => word);
}

function extractRecurringPhrases(chunks, limit = 6) {
  const counts = new Map();

  for (const chunk of chunks) {
    const words = tokenize(chunk).filter((word) => !STOPWORDS.has(word));

    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= words.length - size; index += 1) {
        const phrase = words.slice(index, index + size).join(" ");
        if (phrase.length < 10) continue;
        counts.set(phrase, (counts.get(phrase) || 0) + 1);
      }
    }
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([phrase]) => phrase);
}

function buildToneDescriptors(chunks) {
  const text = chunks.join(" ");
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const sentenceWordCounts = sentences.map((sentence) => tokenize(sentence).length);
  const averageSentenceLength = sentenceWordCounts.length
    ? sentenceWordCounts.reduce((sum, count) => sum + count, 0) / sentenceWordCounts.length
    : 0;
  const questionRate = sentences.length
    ? sentences.filter((sentence) => sentence.includes("?")).length / sentences.length
    : 0;

  const descriptors = [];

  if (averageSentenceLength <= 10) {
    descriptors.push("kurze, klare Sätze");
  } else if (averageSentenceLength >= 18) {
    descriptors.push("längere, erklärende Sätze");
  } else {
    descriptors.push("ruhige, mittlere Satzlänge");
  }

  if (questionRate >= 0.12) {
    descriptors.push("arbeitet mit Rückfragen");
  }

  if (/\b(wir|uns|gemeinsam|zusammen|euch|ihr)\b/i.test(text)) {
    descriptors.push("spricht verbindend und paarorientiert");
  }

  if (/\b(startet|macht|setzt|probiert|naechste[rn]? schritt|konkret|mini-ritual)\b/i.test(text)) {
    descriptors.push("ist konkret und handlungsorientiert");
  }

  if (/\b(gut|gerne|wertvoll|ermutig|willkommen|freut|dankbar|schoen)\b/i.test(text)) {
    descriptors.push("klingt warm und ermutigend");
  }

  return Array.from(new Set(descriptors)).slice(0, 4);
}

function buildPersonaProfile(chunks) {
  const vocabulary = countTopWords(chunks, 10);
  const recurringPhrases = extractRecurringPhrases(chunks, 6);
  const toneDescriptors = buildToneDescriptors(chunks);
  const styleSummaryParts = [];

  if (toneDescriptors.length) {
    styleSummaryParts.push(`Stil: ${toneDescriptors.join(", ")}.`);
  }

  if (vocabulary.length) {
    styleSummaryParts.push(`Typische Wörter: ${vocabulary.slice(0, 6).join(", ")}.`);
  }

  if (recurringPhrases.length) {
    styleSummaryParts.push(
      `Wiederkehrende Formulierungen: ${recurringPhrases.slice(0, 4).join("; ")}.`
    );
  }

  return {
    styleSummary:
      styleSummaryParts.join(" ") ||
      "Klar, warm und auf den nächsten machbaren Schritt ausgerichtet.",
    toneDescriptors,
    recurringPhrases,
    vocabulary,
    avoidPatterns: GENERIC_AVOID_PATTERNS,
    sampleCount: chunks.length,
  };
}

async function refreshPersonaProfiles(coupleId) {
  const scopeKey = coupleId || "global";

  for (const speaker of PERSONA_SPEAKERS) {
    const rows = await prisma.transcriptChunk.findMany({
      where: {
        speaker,
        qualityStatus: {
          in: Array.from(STYLE_ELIGIBLE_QUALITY),
        },
        transcript: coupleId ? { coupleId } : { coupleId: null },
      },
      select: {
        content: true,
      },
    });

    if (!rows.length) {
      await prisma.transcriptPersonaProfile.deleteMany({
        where: {
          scopeKey,
          speaker,
        },
      });
      continue;
    }

    const profile = buildPersonaProfile(rows.map((row) => row.content));

    await prisma.transcriptPersonaProfile.upsert({
      where: {
        scopeKey_speaker: {
          scopeKey,
          speaker,
        },
      },
      update: {
        coupleId,
        styleSummary: profile.styleSummary,
        toneDescriptors: profile.toneDescriptors,
        recurringPhrases: profile.recurringPhrases,
        vocabulary: profile.vocabulary,
        avoidPatterns: profile.avoidPatterns,
        sampleCount: profile.sampleCount,
      },
      create: {
        scopeKey,
        coupleId,
        speaker,
        styleSummary: profile.styleSummary,
        toneDescriptors: profile.toneDescriptors,
        recurringPhrases: profile.recurringPhrases,
        vocabulary: profile.vocabulary,
        avoidPatterns: profile.avoidPatterns,
        sampleCount: profile.sampleCount,
      },
    });
  }
}

async function main() {
  const transcriptDir = process.env.TRANSCRIPT_DIR;
  if (!transcriptDir) {
    console.error("TRANSCRIPT_DIR ist nicht gesetzt.");
    process.exit(1);
  }

  const transcriptCoupleId = process.env.TRANSCRIPT_COUPLE_ID?.trim() || null;

  const resolvedDir = path.resolve(transcriptDir);
  if (!fs.existsSync(resolvedDir)) {
    console.error(`Verzeichnis nicht gefunden: ${resolvedDir}`);
    process.exit(1);
  }

  if (transcriptCoupleId) {
    const couple = await prisma.couple.findUnique({
      where: { id: transcriptCoupleId },
      select: { id: true },
    });

    if (!couple) {
      console.error(`Couple nicht gefunden: ${transcriptCoupleId}`);
      process.exit(1);
    }
  }

  if (process.env.RESET_TRANSCRIPTS === "true") {
    await prisma.transcriptPersonaProfile.deleteMany({});
    await prisma.transcriptChunk.deleteMany({});
    await prisma.transcript.deleteMany({});
  }

  const files = collectFiles(resolvedDir);
  if (!files.length) {
    console.error("Keine Transkript-Dateien gefunden.");
    process.exit(1);
  }

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const raw = await readTranscriptContent(filePath, ext);
    const normalized = normalizeText(raw, ext);
    const { title, sessionDate, body } = extractMetadata(normalized, filePath, ext);

    const segments = splitIntoSpeakerSegments(body);
    const effectiveSegments = segments.length
      ? segments
      : [
          {
            speaker: "UNKNOWN",
            qualityStatus: "UNKNOWN",
            speakerLabel: null,
            content: normalizeWhitespace(body),
          },
        ];

    const chunkRows = [];
    let chunkIndex = 0;

    for (const segment of effectiveSegments) {
      const chunks = splitIntoChunks(segment.content, MAX_CHARS, OVERLAP);

      for (const content of chunks) {
        chunkRows.push({
          chunkIndex,
          content,
          speaker: segment.speaker,
          qualityStatus: segment.qualityStatus,
        });
        chunkIndex += 1;
      }
    }

    if (!chunkRows.length) {
      continue;
    }

    const topics = inferTopicsFromTitle(title);
    const transcript = await prisma.transcript.create({
      data: {
        title,
        sourcePath: filePath,
        sessionDate,
        coupleId: transcriptCoupleId,
        topics,
        metadata: {
          fileName: path.basename(filePath),
          format: ext.replace(/^\./, ""),
        },
      },
    });

    await prisma.transcriptChunk.createMany({
      data: chunkRows.map((row) => ({
        transcriptId: transcript.id,
        chunkIndex: row.chunkIndex,
        content: row.content,
        speaker: row.speaker,
        qualityStatus: row.qualityStatus,
      })),
    });

    console.log(
      `Importiert: ${filePath} (${chunkRows.length} Chunks, ${effectiveSegments.length} Segmente)`
    );
  }

  await refreshPersonaProfiles(transcriptCoupleId);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
