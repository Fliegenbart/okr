-- Backdated scoring: lets users record a KR update with the date they really
-- did the scoring, not the moment the form was submitted. Nullable keeps all
-- existing rows valid (NULL = "treat createdAt as the scoring moment").
ALTER TABLE "KeyResultUpdate" ADD COLUMN "occurredAt" TIMESTAMP(3);
