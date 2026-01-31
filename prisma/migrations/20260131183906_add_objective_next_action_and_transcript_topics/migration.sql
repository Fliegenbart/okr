-- AlterTable
ALTER TABLE "Objective" ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "nextActionOwnerId" TEXT;

-- AlterTable
ALTER TABLE "Transcript" ADD COLUMN     "topics" JSONB;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_nextActionOwnerId_fkey" FOREIGN KEY ("nextActionOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
