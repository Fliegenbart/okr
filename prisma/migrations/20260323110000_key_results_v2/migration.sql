CREATE TYPE "KeyResultType" AS ENUM ('INCREASE_TO', 'STAY_ABOVE', 'STAY_BELOW', 'BINARY', 'TRAFFIC_LIGHT');

CREATE TYPE "KeyResultDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER');

ALTER TABLE "KeyResult"
ADD COLUMN     "type" "KeyResultType" NOT NULL DEFAULT 'INCREASE_TO',
ADD COLUMN     "direction" "KeyResultDirection" NOT NULL DEFAULT 'HIGHER_IS_BETTER',
ADD COLUMN     "startValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "redThreshold" DOUBLE PRECISION,
ADD COLUMN     "yellowThreshold" DOUBLE PRECISION,
ADD COLUMN     "greenThreshold" DOUBLE PRECISION,
ADD COLUMN     "description" TEXT;

UPDATE "KeyResult" AS kr
SET "startValue" = COALESCE(
  (
    SELECT COALESCE(kru."previousValue", kru."value")
    FROM "KeyResultUpdate" AS kru
    WHERE kru."keyResultId" = kr."id"
    ORDER BY kru."createdAt" ASC
    LIMIT 1
  ),
  kr."currentValue",
  0
);
