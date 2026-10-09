-- Mini shop, slice 2: items put on a game.
-- Two kinds, both a Sale with a bookingId:
--   * "on the game": no payer. Its lines raise Booking.amountDueUsd (reason SHOP_ITEMS) and it never
--     gets a payment of its own: the booking collection takes the money.
--   * "on a player": a payer (a person, or a typed name with an optional phone). It is that player's
--     tab, collected through its own SALE payment. It never changes the booking due.
-- Sale and SaleItem stay insert-only: a removal is a second line with a negative quantity that names
-- the line it reverses. There are still no append-only triggers on Payment or LedgerEntry (ROADMAP F-2).

-- AlterEnum
ALTER TYPE "BookingDueReason" ADD VALUE 'SHOP_ITEMS';

-- AlterTable: who owes a tab
ALTER TABLE "Sale"
  ADD COLUMN "payerPersonId" TEXT,
  ADD COLUMN "payerName" TEXT,
  ADD COLUMN "payerPhone" TEXT;

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_payer_needs_booking"
  CHECK (("payerPersonId" IS NULL AND "payerName" IS NULL) OR "bookingId" IS NOT NULL);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_payer_one_identity"
  CHECK ("payerPersonId" IS NULL OR "payerName" IS NULL);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_payerName_not_blank"
  CHECK ("payerName" IS NULL OR length(btrim("payerName")) > 0);
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_payerPhone_needs_name"
  CHECK ("payerPhone" IS NULL OR "payerName" IS NOT NULL);

-- A real foreign key on the booking (it was a bare column in slice 1) and on the payer.
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_payerPersonId_fkey"
  FOREIGN KEY ("payerPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Sale_bookingId_idx" ON "Sale"("bookingId");
CREATE INDEX "Sale_payerPersonId_idx" ON "Sale"("payerPersonId");

-- One "on the game" sale per booking, and one tab per payer on a booking (a second add appends lines).
CREATE UNIQUE INDEX "Sale_booking_game_key" ON "Sale"("bookingId")
  WHERE "bookingId" IS NOT NULL AND "payerPersonId" IS NULL AND "payerName" IS NULL;
CREATE UNIQUE INDEX "Sale_booking_payer_person_key" ON "Sale"("bookingId", "payerPersonId")
  WHERE "payerPersonId" IS NOT NULL;
CREATE UNIQUE INDEX "Sale_booking_payer_name_key" ON "Sale"("bookingId", lower("payerName"))
  WHERE "payerName" IS NOT NULL;

-- AlterTable: SaleItem gets a time of its own and a way to reverse a line.
ALTER TABLE "SaleItem"
  ADD COLUMN "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "reversesItemId" TEXT;

UPDATE "SaleItem" si SET "addedAt" = s."soldAt" FROM "Sale" s WHERE s."id" = si."saleId";

ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_qty_range";
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_qty_range" CHECK ("qty" BETWEEN -99 AND 99 AND "qty" <> 0);
-- Negative exactly when it reverses a line: a walk-in or booking sale can never write a negative line
-- without naming what it reverses.
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_reversal_sign"
  CHECK (("qty" > 0 AND "reversesItemId" IS NULL) OR ("qty" < 0 AND "reversesItemId" IS NOT NULL));

ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_reversesItemId_fkey"
  FOREIGN KEY ("reversesItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SaleItem_tenantId_addedAt_idx" ON "SaleItem"("tenantId", "addedAt");
CREATE INDEX "SaleItem_reversesItemId_idx" ON "SaleItem"("reversesItemId");

-- A reversal must name a positive line of the same sale, item and price, and may never take the net
-- quantity of that line below zero. (The use case checks this under the sale row lock too; this is the
-- last line of defence.)
CREATE FUNCTION "SaleItem_check_reversal"() RETURNS trigger AS $$
DECLARE
  original RECORD;
  net INTEGER;
BEGIN
  IF NEW."reversesItemId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "saleId", "productId", "qty", "unitPriceUsd" INTO original
    FROM "SaleItem" WHERE "id" = NEW."reversesItemId";
  IF NOT FOUND
     OR original."saleId" <> NEW."saleId"
     OR original."productId" <> NEW."productId"
     OR original."qty" <= 0
     OR original."unitPriceUsd" <> NEW."unitPriceUsd" THEN
    RAISE EXCEPTION 'SaleItem reversal must reverse a positive line of the same sale, item and price';
  END IF;
  SELECT original."qty" + COALESCE(SUM("qty"), 0) INTO net
    FROM "SaleItem" WHERE "reversesItemId" = NEW."reversesItemId";
  IF net + NEW."qty" < 0 THEN
    RAISE EXCEPTION 'SaleItem reversal would take the net quantity below zero';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SaleItem_check_reversal_trg"
  BEFORE INSERT ON "SaleItem"
  FOR EACH ROW EXECUTE FUNCTION "SaleItem_check_reversal"();

-- A game's "on the game" sale is paid through the booking, never on its own: refuse a SALE payment for
-- a sale that has a booking and no payer. (Payment cannot import Shop, so the guard sits in the database,
-- where recordPayment's insert runs into it.)
CREATE FUNCTION "Payment_check_sale_source"() RETURNS trigger AS $$
BEGIN
  IF NEW."sourceType" = 'SALE' AND EXISTS (
    SELECT 1 FROM "Sale" s
    WHERE s."id" = NEW."sourceId"
      AND s."bookingId" IS NOT NULL
      AND s."payerPersonId" IS NULL
      AND s."payerName" IS NULL
  ) THEN
    RAISE EXCEPTION 'A sale put on a game without a payer is paid through the booking, not on its own';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Payment_check_sale_source_trg"
  BEFORE INSERT ON "Payment"
  FOR EACH ROW EXECUTE FUNCTION "Payment_check_sale_source"();
