-- AlterTable
ALTER TABLE "Couple" ADD COLUMN     "checkInDurationMinutes" INTEGER,
ADD COLUMN     "checkInTime" TEXT,
ADD COLUMN     "checkInTimeZone" TEXT,
ADD COLUMN     "checkInWeekday" INTEGER;
