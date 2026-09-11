-- SPEC-06 step 1: ExchangeRate, Payment, PaymentTender, LedgerEntry (DR-002 §2.14–2.21).
-- No booking_id on Payment (polymorphic source_type + source_id).
-- Tender amount is DECIMAL(18,2); domain will enforce USD cents vs integer LBP.
-- tenantId on every table including the child (DR-001).

CREATE TYPE "PaymentSourceType" AS ENUM ('BOOKING');

CREATE TYPE "Currency" AS ENUM ('USD', 'LBP');

CREATE TYPE "LedgerDirection" AS ENUM ('IN', 'OUT');

CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "lbpPerUsd" DECIMAL(18,0) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" "PaymentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amountDueUsd" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentTender" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "rateAtTime" DECIMAL(18,0),
    "usdEquivalent" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "PaymentTender_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amountUsd" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceType" "PaymentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExchangeRate_tenantId_idx" ON "ExchangeRate"("tenantId");

CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

CREATE INDEX "Payment_sourceType_sourceId_idx" ON "Payment"("sourceType", "sourceId");

CREATE INDEX "PaymentTender_tenantId_idx" ON "PaymentTender"("tenantId");

CREATE INDEX "LedgerEntry_tenantId_idx" ON "LedgerEntry"("tenantId");

ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentTender" ADD CONSTRAINT "PaymentTender_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PaymentTender" ADD CONSTRAINT "PaymentTender_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
