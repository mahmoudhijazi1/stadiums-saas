-- Security audit S-6. The name typed on a public request when it differs from the
-- stored Person name. Nullable with no default: safe while old code still runs
-- (it never writes the column), and existing rows stay NULL.

ALTER TABLE "Booking" ADD COLUMN "requestedName" TEXT;
