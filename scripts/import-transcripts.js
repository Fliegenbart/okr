/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SUPPORTED_EXTENSIONS = new Set([".txt", ".md", ".srt", ".vtt"]);
const MAX_CHARS = Number(process.env.TRANSCRIPT_CHUNK_SIZE || 1200);
const OVERLAP = Number(process.env.TRANSCRIPT_CHUNK_OVERLAP || 200);

function inferTopicsFromTitle(title) {
  const lower = title.toLowerCase();
  const topics = new Set();

  if (/(konflikt|streit|repair|eskal)/.test(lower)) topics.add("KONFLIKT");
  if (/(prioris|zu viele|punkte|nicht-jetzt)/.test(lower))
    topics.add("PRIORISIERUNG");
  if (/(intim|naehe|sexual|beruehr)/.test(lower)) topics.add("INTIMITAET");
  if (/(finanz|geld|money)/.test(lower)) topics.add("FINANZEN");

  return Array.from(topics);
}

function normalizeText(content, ext) {
  const lines = content.split(/\r?\n/);

  if (ext === ".srt" || ext === ".vtt") {
    const filtered = lines.filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      if (trimmed === "WEBVTT") return false;
      if (/^\d+$/.test(trimmed)) return false;
      if (trimmed.includes("-->")) return false;
      return true;
    });
    return filtered.join(" ");
  }

  return lines.join(" ");
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
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        files.push(fullPath);
      }
    }
  }
  return files;
}

async function main() {
  const transcriptDir = process.env.TRANSCRIPT_DIR;
  if (!transcriptDir) {
    console.error("TRANSCRIPT_DIR ist nicht gesetzt.");
    process.exit(1);
  }

  const resolvedDir = path.resolve(transcriptDir);
  if (!fs.existsSync(resolvedDir)) {
    console.error(`Verzeichnis nicht gefunden: ${resolvedDir}`);
    process.exit(1);
  }

  if (process.env.RESET_TRANSCRIPTS === "true") {
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
    const raw = fs.readFileSync(filePath, "utf8");
    const normalized = normalizeText(raw, ext);
    const chunks = splitIntoChunks(normalized, MAX_CHARS, OVERLAP);

    if (!chunks.length) {
      continue;
    }

    const title = path.basename(filePath, ext).replace(/[_-]/g, " ");
    const topics = inferTopicsFromTitle(title);

    const transcript = await prisma.transcript.create({
      data: {
        title,
        sourcePath: filePath,
        topics,
        metadata: {
          fileName: path.basename(filePath),
        },
      },
    });

    await prisma.transcriptChunk.createMany({
      data: chunks.map((content, index) => ({
        transcriptId: transcript.id,
        chunkIndex: index,
        content,
      })),
    });

    console.log(`Importiert: ${filePath} (${chunks.length} Chunks)`);
  }
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
