-- CreateTable
CREATE TABLE "BoardConnection" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "fromElementId" TEXT NOT NULL,
    "toElementId" TEXT NOT NULL,
    "color" TEXT,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BoardConnection_boardId_idx" ON "BoardConnection"("boardId");

-- CreateIndex
CREATE INDEX "BoardConnection_fromElementId_idx" ON "BoardConnection"("fromElementId");

-- CreateIndex
CREATE INDEX "BoardConnection_toElementId_idx" ON "BoardConnection"("toElementId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardConnection_boardId_fromElementId_toElementId_key" ON "BoardConnection"("boardId", "fromElementId", "toElementId");

-- AddForeignKey
ALTER TABLE "BoardConnection" ADD CONSTRAINT "BoardConnection_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardConnection" ADD CONSTRAINT "BoardConnection_fromElementId_fkey" FOREIGN KEY ("fromElementId") REFERENCES "BoardElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardConnection" ADD CONSTRAINT "BoardConnection_toElementId_fkey" FOREIGN KEY ("toElementId") REFERENCES "BoardElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
