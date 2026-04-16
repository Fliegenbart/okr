-- CreateEnum
CREATE TYPE "ObjectiveSortOption" AS ENUM ('CREATED_ASC', 'ALPHABETICAL_ASC', 'PROGRESS_ASC', 'PROGRESS_DESC');

-- CreateEnum
CREATE TYPE "KeyResultSortOption" AS ENUM ('CREATED_ASC', 'ALPHABETICAL_ASC', 'PROGRESS_ASC', 'PROGRESS_DESC', 'STALEST_FIRST');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "preferredKeyResultSort" "KeyResultSortOption" NOT NULL DEFAULT 'CREATED_ASC',
ADD COLUMN     "preferredObjectiveSort" "ObjectiveSortOption" NOT NULL DEFAULT 'CREATED_ASC';
