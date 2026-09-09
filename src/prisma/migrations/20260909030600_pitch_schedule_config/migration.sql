-- SPEC-02 step 1: required jsonb schedule_config on Pitch (closed-week default)
-- Prisma Json → PostgreSQL jsonb (Prisma schema reference, default type mapping)

ALTER TABLE "Pitch" ADD COLUMN "scheduleConfig" JSONB NOT NULL DEFAULT '{"slotDurationMinutes": 60, "gapMinutes": 0, "hours": {"mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": []}, "defaultPriceUsd": "0.00", "priceRules": []}';
