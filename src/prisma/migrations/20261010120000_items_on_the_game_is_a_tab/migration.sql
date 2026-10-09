-- "On the game" is now the booker's tab: items put on a game never change the booking due.
-- Slice 2 (20261010090000, already applied) let a sale with a booking and no payer raise the due. That
-- path is gone, so nothing may rely on it any more:
--   * the "no payment of its own" trigger on Payment goes (no such sale can exist),
--   * the one-"on the game"-sale-per-booking unique index goes,
--   * a sale on a booking must name a payer (CHECK).
-- The enum value BookingDueReason.SHOP_ITEMS stays (Postgres cannot drop an enum value) and is unused.

-- Refuse to run over data that used the old path: it must be converted to the booker's tab first
-- (and the due it raised taken back) by hand. The dev database had none.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Sale"
    WHERE "bookingId" IS NOT NULL AND "payerPersonId" IS NULL AND "payerName" IS NULL
  ) THEN
    RAISE EXCEPTION 'Sales put "on the game" in slice 2 must be converted to the booker tab first';
  END IF;
END $$;

DROP TRIGGER "Payment_check_sale_source_trg" ON "Payment";
DROP FUNCTION "Payment_check_sale_source"();

DROP INDEX "Sale_booking_game_key";

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_booking_needs_payer"
  CHECK ("bookingId" IS NULL OR "payerPersonId" IS NOT NULL OR "payerName" IS NOT NULL);
