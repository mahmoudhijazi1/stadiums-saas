-- SPEC-05 step 1: SlotInterest (DR-002 §2.13).
-- during is Postgres tstzrange (Prisma Unsupported), same as Booking.
-- tenantId required (DR-001). Table stays empty until approve writes (step 6).

CREATE TABLE "SlotInterest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pitchId" TEXT NOT NULL,
    "during" tstzrange NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlotInterest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SlotInterest_tenantId_idx" ON "SlotInterest"("tenantId");

ALTER TABLE "SlotInterest" ADD CONSTRAINT "SlotInterest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SlotInterest" ADD CONSTRAINT "SlotInterest_pitchId_fkey" FOREIGN KEY ("pitchId") REFERENCES "Pitch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SlotInterest" ADD CONSTRAINT "SlotInterest_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
