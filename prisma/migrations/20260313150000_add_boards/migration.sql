-- CreateEnum
CREATE TYPE "BoardScope" AS ENUM ('MASTER', 'QUARTER');

-- CreateEnum
CREATE TYPE "BoardElementType" AS ENUM ('NOTE', 'TEXT', 'FRAME');

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "coupleId" TEXT NOT NULL,
    "quarterId" TEXT,
    "scope" "BoardScope" NOT NULL,
    "boardKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardElement" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "type" "BoardElementType" NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "color" TEXT,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "zIndex" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Board_coupleId_boardKey_key" ON "Board"("coupleId", "boardKey");

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_coupleId_fkey" FOREIGN KEY ("coupleId") REFERENCES "Couple"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_quarterId_fkey" FOREIGN KEY ("quarterId") REFERENCES "Quarter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardElement" ADD CONSTRAINT "BoardElement_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
