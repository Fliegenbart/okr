-- CreateEnum
CREATE TYPE "TranscriptSpeaker" AS ENUM ('DANIEL', 'CHRISTIANE', 'OTHER', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TranscriptQualityStatus" AS ENUM ('VERIFIED', 'INFERRED', 'MIXED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Transcript"
ADD COLUMN "sessionDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TranscriptChunk"
ADD COLUMN "speaker" "TranscriptSpeaker" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "qualityStatus" "TranscriptQualityStatus" NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "TranscriptPersonaProfile" (
    "id" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "coupleId" TEXT,
    "speaker" "TranscriptSpeaker" NOT NULL,
    "styleSummary" TEXT NOT NULL,
    "toneDescriptors" JSONB NOT NULL,
    "recurringPhrases" JSONB NOT NULL,
    "vocabulary" JSONB NOT NULL,
    "avoidPatterns" JSONB NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptPersonaProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptChunk_speaker_qualityStatus_idx" ON "TranscriptChunk"("speaker", "qualityStatus");

-- CreateIndex
CREATE INDEX "TranscriptChunk_transcriptId_speaker_idx" ON "TranscriptChunk"("transcriptId", "speaker");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptPersonaProfile_scopeKey_speaker_key" ON "TranscriptPersonaProfile"("scopeKey", "speaker");

-- CreateIndex
CREATE INDEX "TranscriptPersonaProfile_coupleId_idx" ON "TranscriptPersonaProfile"("coupleId");

-- AddForeignKey
ALTER TABLE "TranscriptPersonaProfile"
ADD CONSTRAINT "TranscriptPersonaProfile_coupleId_fkey"
FOREIGN KEY ("coupleId") REFERENCES "Couple"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
