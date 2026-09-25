-- SPEC-16 slice 1. Append-only log of Booking.amountDueUsd changes.
-- CHECK and the backfill are SQL-only. The exclusion constraint is not touched.

CREATE TYPE "BookingDueReason" AS ENUM (
  'LATE_CANCELLATION_FEE',
  'NO_SHOW_FEE',
  'CANCELLATION_NO_FEE',
  'PARTIAL_GAME',
  'DISCOUNT',
  'WAIVER',
  'CORRECTION'
);

CREATE TABLE "BookingDueChange" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "fromUsd" DECIMAL(12,2) NOT NULL,
  "toUsd" DECIMAL(12,2) NOT NULL,
  "reason" "BookingDueReason" NOT NULL,
  "note" TEXT,
  "actorMembershipId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingDueChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingDueChange_usd_nonneg" CHECK ("fromUsd" >= 0 AND "toUsd" >= 0)
);

CREATE INDEX "BookingDueChange_tenantId_bookingId_idx"
  ON "BookingDueChange" ("tenantId", "bookingId");

ALTER TABLE "BookingDueChange"
  ADD CONSTRAINT "BookingDueChange_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingDueChange"
  ADD CONSTRAINT "BookingDueChange_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingDueChange"
  ADD CONSTRAINT "BookingDueChange_actorMembershipId_fkey"
  FOREIGN KEY ("actorMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SPEC-16 §3.3 backfill. Cancelled rows kept amountDueUsd = priceUsd.
-- Once a cancelled remainder counts as owed, those rows would show debts.
-- Set amountDueUsd = LEAST(priceUsd, collected USD on BOOKING payments).
-- No BookingDueChange rows: this is a data correction, not an owner decision.

UPDATE "Booking" b
SET "amountDueUsd" = LEAST(
  b."priceUsd",
  COALESCE((
    SELECT SUM(t."usdEquivalent")
    FROM "Payment" pay
    JOIN "PaymentTender" t ON t."paymentId" = pay.id
    WHERE pay."tenantId" = b."tenantId"
      AND pay."sourceType" = 'BOOKING'
      AND pay."sourceId" = b.id
  ), 0)
)
WHERE b.status = 'CANCELLED';

DO $$
DECLARE
  still_open integer;
BEGIN
  SELECT COUNT(*) INTO still_open
  FROM "Booking" b
  WHERE b.status = 'CANCELLED'
    AND b."amountDueUsd" > COALESCE((
      SELECT SUM(t."usdEquivalent")
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'
        AND pay."sourceId" = b.id
    ), 0);
  IF still_open > 0 THEN
    RAISE EXCEPTION 'cancelled bookings still above collected: %', still_open;
  END IF;
END $$;
