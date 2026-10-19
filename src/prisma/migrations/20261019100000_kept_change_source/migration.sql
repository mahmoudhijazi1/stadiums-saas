-- DR-007 decision 15 ("keep it"): the change a player leaves is its own payment, with this source type.
-- Its own migration: a new enum value cannot be used in the transaction that adds it. Permanent:
-- Postgres cannot drop an enum value. Payment.sourceType and LedgerEntry.sourceType share this enum.

ALTER TYPE "PaymentSourceType" ADD VALUE 'KEPT_CHANGE';
