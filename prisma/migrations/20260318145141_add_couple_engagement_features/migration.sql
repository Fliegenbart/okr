-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('OPEN', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommitmentSource" AS ENUM ('MANUAL', 'OBJECTIVE', 'CHECK_IN');

-- CreateEnum
CREATE TYPE "TimelineEventKind" AS ENUM ('CHECK_IN', 'OBJECTIVE_UPDATE', 'COMMITMENT_CREATED', 'COMMITMENT_DONE', 'NOTE', 'MILESTONE', 'REMINDER');

-- CreateEnum
CREATE TYPE "ReminderKind" AS ENUM ('CHECK_IN', 'COMMITMENT', 'QUARTER_REVIEW');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'DONE', 'DISMISSED');

-- CreateTable
CREATE TABLE "CheckInSession" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "quarterId" TEXT,
    "templateKey" TEXT,
    "title" TEXT NOT NULL,
    "moodRating" INTEGER,
    "highlights" TEXT,
    "tensions" TEXT,
    "summary" TEXT,
    "nextSteps" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckInSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "checkInSessionId" TEXT,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "CommitmentStatus" NOT NULL DEFAULT 'OPEN',
    "source" "CommitmentSource" NOT NULL DEFAULT 'MANUAL',
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "kind" "TimelineEventKind" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "objectiveId" TEXT,
    "commitmentId" TEXT,
    "checkInSessionId" TEXT,
    "reminderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "quarterId" TEXT,
    "commitmentId" TEXT,
    "checkInSessionId" TEXT,
    "kind" "ReminderKind" NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdById" TEXT,
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckInSession_coupleId_createdAt_idx" ON "CheckInSession"("coupleId", "createdAt");

-- CreateIndex
CREATE INDEX "CheckInSession_quarterId_createdAt_idx" ON "CheckInSession"("quarterId", "createdAt");

-- CreateIndex
CREATE INDEX "Commitment_coupleId_status_idx" ON "Commitment"("coupleId", "status");

-- CreateIndex
CREATE INDEX "Commitment_objectiveId_status_idx" ON "Commitment"("objectiveId", "status");

-- CreateIndex
CREATE INDEX "Commitment_checkInSessionId_idx" ON "Commitment"("checkInSessionId");

-- CreateIndex
CREATE INDEX "TimelineEvent_coupleId_createdAt_idx" ON "TimelineEvent"("coupleId", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_kind_createdAt_idx" ON "TimelineEvent"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Reminder_coupleId_status_dueAt_idx" ON "Reminder"("coupleId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Reminder_kind_dueAt_idx" ON "Reminder"("kind", "dueAt");

-- AddForeignKey
ALTER TABLE "CheckInSession" ADD CONSTRAINT "CheckInSession_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInSession" ADD CONSTRAINT "CheckInSession_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "Quarter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInSession" ADD CONSTRAINT "CheckInSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_checkInSessionId_fkey" FOREIGN KEY ("checkInSessionId") REFERENCES "CheckInSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "Commitment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_checkInSessionId_fkey" FOREIGN KEY ("checkInSessionId") REFERENCES "CheckInSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_reminderId_fkey" FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "Quarter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "Commitment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_checkInSessionId_fkey" FOREIGN KEY ("checkInSessionId") REFERENCES "CheckInSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
