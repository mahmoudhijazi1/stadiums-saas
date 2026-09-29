-- SPEC-15 slice 2 (P2, P5). Default player count per pitch, 1..30.
-- The CHECK lives here because Prisma cannot declare it.

ALTER TABLE "Pitch" ADD COLUMN "defaultPlayerCount" INTEGER NOT NULL DEFAULT 10;

ALTER TABLE "Pitch"
  ADD CONSTRAINT "Pitch_defaultPlayerCount_range"
  CHECK ("defaultPlayerCount" BETWEEN 1 AND 30);
