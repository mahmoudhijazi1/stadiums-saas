-- F-2, first step: a ledger row records the payment it was written for. Additive and nullable: no
-- backfill, rows written before this stay NULL (their payment can only be guessed from the source and
-- the time, which is what the activity list still does for them). New rows are written by
-- recordPayment, in the payment's transaction.

ALTER TABLE "LedgerEntry" ADD COLUMN "paymentId" TEXT;

ALTER TABLE "LedgerEntry"
  ADD CONSTRAINT "LedgerEntry_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "LedgerEntry_tenantId_paymentId_idx" ON "LedgerEntry"("tenantId", "paymentId");

-- One ledger row of each source type per payment. Partial: old rows have no payment. A later row type
-- (for example the "keep it" rows of DR-007) gets its own sourceType value and so its own row.
CREATE UNIQUE INDEX "LedgerEntry_paymentId_sourceType_key"
  ON "LedgerEntry"("paymentId", "sourceType")
  WHERE "paymentId" IS NOT NULL;
