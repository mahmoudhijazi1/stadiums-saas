-- SPEC-03 step 2: two APPROVED bookings on the same pitch must not overlap (DR-002 §2.8).
-- Prisma cannot express EXCLUDE — this is why we chose Postgres. PENDING is ignored on purpose.
-- btree_gist: GiST has no built-in = for TEXT; we need it so pitchId can sit next to during &&.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_approved_during_excl"
  EXCLUDE USING gist (
    "pitchId" WITH =,
    "during" WITH &&
  )
  WHERE ("status" = 'APPROVED');
