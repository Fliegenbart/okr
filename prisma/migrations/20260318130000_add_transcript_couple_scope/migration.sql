ALTER TABLE "Transcript" ADD COLUMN "coupleId" TEXT;

CREATE INDEX "Transcript_coupleId_idx" ON "Transcript"("coupleId");

ALTER TABLE "Transcript"
ADD CONSTRAINT "Transcript_coupleId_fkey"
FOREIGN KEY ("coupleId") REFERENCES "Couple"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
