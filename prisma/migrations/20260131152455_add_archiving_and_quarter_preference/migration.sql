-- AlterTable
ALTER TABLE "KeyResult" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Objective" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredQuarterId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_preferredQuarterId_fkey" FOREIGN KEY ("preferredQuarterId") REFERENCES "Quarter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
