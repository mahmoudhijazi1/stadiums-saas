-- SPEC-03 step 1: Person + Booking + BookingParticipant (DR-002 §2.1–2.3, §2.8–2.10).
-- during is Postgres tstzrange (Prisma Unsupported). Exclusion constraint is step 2.

CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'NO_SHOW');

CREATE TYPE "BookingSource" AS ENUM ('OWNER', 'PUBLIC');

CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "during" tstzrange NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "source" "BookingSource" NOT NULL,
    "priceUsd" DECIMAL(12,2) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BookingParticipant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "amountDueUsd" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "isRequester" BOOLEAN NOT NULL,

    CONSTRAINT "BookingParticipant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Person_tenantId_idx" ON "Person"("tenantId");

CREATE UNIQUE INDEX "Person_tenantId_phone_key" ON "Person"("tenantId", "phone");

CREATE INDEX "Booking_tenantId_idx" ON "Booking"("tenantId");

CREATE INDEX "BookingParticipant_tenantId_idx" ON "BookingParticipant"("tenantId");

ALTER TABLE "Person" ADD CONSTRAINT "Person_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingParticipant" ADD CONSTRAINT "BookingParticipant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingParticipant" ADD CONSTRAINT "BookingParticipant_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BookingParticipant" ADD CONSTRAINT "BookingParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
