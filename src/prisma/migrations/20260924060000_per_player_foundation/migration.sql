-- SPEC-15 slice 1. Foundation only. Exclusion constraint is untouched.
-- Partial unique indexes and CHECKs live here because Prisma cannot declare WHERE or CHECK.

CREATE TYPE "CollectionMode" AS ENUM ('WHOLE', 'PER_PLAYER');

ALTER TABLE "Booking"
  ADD COLUMN "collectionMode" "CollectionMode" NOT NULL DEFAULT 'WHOLE';

ALTER TABLE "Booking" ADD COLUMN "amountDueUsd" DECIMAL(12,2);

UPDATE "Booking" SET "amountDueUsd" = "priceUsd";

ALTER TABLE "Booking" ALTER COLUMN "amountDueUsd" SET NOT NULL;

-- Stop if any backfilled due is negative. Count was 0 when this was written (priceUsd < 0).
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM "Booking"
  WHERE "amountDueUsd" < 0;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'bookings with negative amountDueUsd: %', bad_count;
  END IF;
END $$;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_amountDueUsd_nonneg" CHECK ("amountDueUsd" >= 0);

ALTER TABLE "BookingParticipant" ALTER COLUMN "personId" DROP NOT NULL;

ALTER TABLE "BookingParticipant" ADD COLUMN "slotNumber" INTEGER;

ALTER TABLE "BookingParticipant" DROP COLUMN "paidAt";

-- Stop if any booking already has two requester rows. Count was 0 when this was written.
DO $$
DECLARE
  dup_count integer;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT "bookingId"
    FROM "BookingParticipant"
    WHERE "isRequester" = true
    GROUP BY "bookingId"
    HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE EXCEPTION 'bookings with more than one requester: %', dup_count;
  END IF;
END $$;

CREATE UNIQUE INDEX "BookingParticipant_one_requester_idx"
  ON "BookingParticipant" ("bookingId")
  WHERE "isRequester" = true;

CREATE INDEX "BookingParticipant_tenantId_personId_idx"
  ON "BookingParticipant" ("tenantId", "personId");

-- Stop if a requester has no person. Count was 0 when this was written.
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM "BookingParticipant"
  WHERE "isRequester" = true AND "personId" IS NULL;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'requester rows with null personId: %', bad_count;
  END IF;
END $$;

ALTER TABLE "BookingParticipant"
  ADD CONSTRAINT "BookingParticipant_requester_has_person"
  CHECK ("isRequester" = false OR "personId" IS NOT NULL);

-- Stop if a participant due is negative. Count was 0 when this was written.
DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM "BookingParticipant"
  WHERE "amountDueUsd" < 0;
  IF bad_count > 0 THEN
    RAISE EXCEPTION 'participants with negative amountDueUsd: %', bad_count;
  END IF;
END $$;

ALTER TABLE "BookingParticipant"
  ADD CONSTRAINT "BookingParticipant_amountDueUsd_nonneg"
  CHECK ("amountDueUsd" >= 0);

CREATE INDEX "BookingParticipant_bookingId_slotNumber_idx"
  ON "BookingParticipant" ("bookingId", "slotNumber");

CREATE UNIQUE INDEX "BookingParticipant_bookingId_slotNumber_not_null_key"
  ON "BookingParticipant" ("bookingId", "slotNumber")
  WHERE "slotNumber" IS NOT NULL;

ALTER TABLE "Person" ALTER COLUMN "phone" DROP NOT NULL;

DROP INDEX "Person_tenantId_phone_key";

CREATE UNIQUE INDEX "Person_tenantId_phone_key"
  ON "Person" ("tenantId", "phone")
  WHERE "phone" IS NOT NULL;

CREATE TABLE "PaymentAllocation" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "amountUsd" DECIMAL(12,2) NOT NULL,

  CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAllocation_amountUsd_positive" CHECK ("amountUsd" > 0)
);

CREATE INDEX "PaymentAllocation_tenantId_idx" ON "PaymentAllocation"("tenantId");

CREATE INDEX "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");

CREATE INDEX "PaymentAllocation_participantId_idx" ON "PaymentAllocation"("participantId");

CREATE UNIQUE INDEX "PaymentAllocation_paymentId_participantId_key"
  ON "PaymentAllocation" ("paymentId", "participantId");

ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentAllocation"
  ADD CONSTRAINT "PaymentAllocation_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "BookingParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
