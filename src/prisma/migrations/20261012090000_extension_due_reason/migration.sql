-- Extend a game by 30 minutes: the due change that raises the price gets its own reason.
-- Additive only. Postgres cannot drop an enum value later, and a new value cannot be used in the
-- transaction that adds it; nothing here uses it.

ALTER TYPE "BookingDueReason" ADD VALUE 'EXTENSION';
