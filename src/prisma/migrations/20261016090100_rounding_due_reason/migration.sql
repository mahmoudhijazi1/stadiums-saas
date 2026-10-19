-- DR-007 decisions 8 and 16: "Consider it paid" writes a due change with reason ROUNDING.
-- Its own migration: a new enum value cannot be used in the transaction that adds it. Permanent:
-- Postgres cannot drop an enum value. Nothing uses it yet.

ALTER TYPE "BookingDueReason" ADD VALUE 'ROUNDING';
