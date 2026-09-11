-- SPEC-08 step 1: composite index for period SUM on ledger (BR-59 / DR-002 §2.20).
-- No new columns or tables. Existing LedgerEntry_tenantId_idx stays.

CREATE INDEX "LedgerEntry_tenantId_occurredAt_idx" ON "LedgerEntry"("tenantId", "occurredAt");
