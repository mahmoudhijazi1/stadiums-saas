-- Weekly recurring bookings. Additive only.
-- A series is only the link between ordinary APPROVED bookings that are created up front
-- (Booking.seriesId). Week k starts at the anchor's local wall-clock time on anchorDate + 7k days.

CREATE TABLE "BookingSeries" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "pitchId" TEXT NOT NULL,
  "personId" TEXT NOT NULL,
  "anchorDate" DATE NOT NULL,
  "anchorTime" VARCHAR(5) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "createdByMembershipId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingSeries_duration_positive" CHECK ("durationMinutes" > 0)
);

CREATE INDEX "BookingSeries_tenantId_idx" ON "BookingSeries"("tenantId");
CREATE INDEX "BookingSeries_pitchId_idx" ON "BookingSeries"("pitchId");
CREATE INDEX "BookingSeries_personId_idx" ON "BookingSeries"("personId");

ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_pitchId_fkey"
  FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_personId_fkey"
  FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSeries" ADD CONSTRAINT "BookingSeries_createdByMembershipId_fkey"
  FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD COLUMN "seriesId" TEXT;
CREATE INDEX "Booking_seriesId_idx" ON "Booking"("seriesId");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_seriesId_fkey"
  FOREIGN KEY ("seriesId") REFERENCES "BookingSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
