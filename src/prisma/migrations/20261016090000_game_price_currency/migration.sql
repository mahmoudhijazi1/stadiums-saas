-- DR-007 slice 3: game money may live in LBP as well as USD. Additive only: every existing row is a
-- USD game and keeps its values; the new currency columns default to 'USD' and the new LBP columns
-- are null. A USD row has its USD columns set and its LBP columns null; an LBP row the opposite
-- (the same shape as "Product_price_by_currency"). Nothing writes LBP yet. Reuses the "Currency" enum.
-- Kept from earlier migrations: "Booking_amountDueUsd_nonneg", "BookingParticipant_amountDueUsd_nonneg",
-- "BookingDueChange_usd_nonneg" and "PaymentAllocation_amountUsd_positive" (a NULL passes them).

-- Guard: every game today has its USD price and due (they are NOT NULL until this migration).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Booking" WHERE "priceUsd" IS NULL OR "amountDueUsd" IS NULL) THEN
    RAISE EXCEPTION 'Booking rows without priceUsd or amountDueUsd: fix them before DR-007 slice 3';
  END IF;
END $$;

-- Booking ------------------------------------------------------------------------------------------
ALTER TABLE "Booking"
  ADD COLUMN "priceCurrency" "Currency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "priceLbp" DECIMAL(18,0),
  ADD COLUMN "amountDueLbp" DECIMAL(18,0),
  ALTER COLUMN "priceUsd" DROP NOT NULL,
  ALTER COLUMN "amountDueUsd" DROP NOT NULL;

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_money_by_currency" CHECK (
  ("priceCurrency" = 'USD' AND "priceUsd" IS NOT NULL AND "amountDueUsd" IS NOT NULL
     AND "priceLbp" IS NULL AND "amountDueLbp" IS NULL)
  OR ("priceCurrency" = 'LBP' AND "priceLbp" IS NOT NULL AND "amountDueLbp" IS NOT NULL
     AND "priceUsd" IS NULL AND "amountDueUsd" IS NULL)
);
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_amountDueLbp_nonneg" CHECK ("amountDueLbp" >= 0);

-- BookingParticipant -------------------------------------------------------------------------------
ALTER TABLE "BookingParticipant"
  ADD COLUMN "amountDueLbp" DECIMAL(18,0),
  ALTER COLUMN "amountDueUsd" DROP NOT NULL;

ALTER TABLE "BookingParticipant" ADD CONSTRAINT "BookingParticipant_due_one_currency" CHECK (
  ("amountDueUsd" IS NOT NULL AND "amountDueLbp" IS NULL)
  OR ("amountDueUsd" IS NULL AND "amountDueLbp" IS NOT NULL)
);
ALTER TABLE "BookingParticipant" ADD CONSTRAINT "BookingParticipant_amountDueLbp_nonneg" CHECK ("amountDueLbp" >= 0);

-- BookingDueChange ---------------------------------------------------------------------------------
ALTER TABLE "BookingDueChange"
  ADD COLUMN "currency" "Currency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "fromLbp" DECIMAL(18,0),
  ADD COLUMN "toLbp" DECIMAL(18,0),
  ALTER COLUMN "fromUsd" DROP NOT NULL,
  ALTER COLUMN "toUsd" DROP NOT NULL;

ALTER TABLE "BookingDueChange" ADD CONSTRAINT "BookingDueChange_pair_by_currency" CHECK (
  ("currency" = 'USD' AND "fromUsd" IS NOT NULL AND "toUsd" IS NOT NULL
     AND "fromLbp" IS NULL AND "toLbp" IS NULL)
  OR ("currency" = 'LBP' AND "fromLbp" IS NOT NULL AND "toLbp" IS NOT NULL
     AND "fromUsd" IS NULL AND "toUsd" IS NULL)
);
ALTER TABLE "BookingDueChange" ADD CONSTRAINT "BookingDueChange_lbp_nonneg" CHECK ("fromLbp" >= 0 AND "toLbp" >= 0);

-- Payment ------------------------------------------------------------------------------------------
-- The due snapshot is in the game's currency. Expense and sale payments stay USD.
ALTER TABLE "Payment"
  ADD COLUMN "dueCurrency" "Currency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "amountDueLbp" DECIMAL(18,0),
  ALTER COLUMN "amountDueUsd" DROP NOT NULL;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_due_by_currency" CHECK (
  ("dueCurrency" = 'USD' AND "amountDueUsd" IS NOT NULL AND "amountDueLbp" IS NULL)
  OR ("dueCurrency" = 'LBP' AND "amountDueLbp" IS NOT NULL AND "amountDueUsd" IS NULL)
);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_lbp_due_only_on_booking" CHECK (
  "dueCurrency" = 'USD' OR "sourceType" = 'BOOKING'
);

-- PaymentAllocation --------------------------------------------------------------------------------
ALTER TABLE "PaymentAllocation"
  ADD COLUMN "amountLbp" DECIMAL(18,0),
  ALTER COLUMN "amountUsd" DROP NOT NULL;

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_one_currency_positive" CHECK (
  ("amountUsd" IS NOT NULL AND "amountUsd" > 0 AND "amountLbp" IS NULL)
  OR ("amountLbp" IS NOT NULL AND "amountLbp" > 0 AND "amountUsd" IS NULL)
);

-- BookingSettlement --------------------------------------------------------------------------------
-- How much of a game's LBP and USD due one payment settled (insert-only, like "SaleAllocation").
-- What an LBP game still owes is its LBP due minus the sum of lbpApplied, so a rate change never
-- changes the pounds owed (DR-007 decision 4). paymentId has no foreign key (Payment does not know
-- what a source is, DR-002 §2.14). Nothing writes it until slice 6.
CREATE TABLE "BookingSettlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "lbpApplied" DECIMAL(18,0) NOT NULL DEFAULT 0,
    "usdApplied" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSettlement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "BookingSettlement_nonneg" CHECK ("lbpApplied" >= 0 AND "usdApplied" >= 0)
);

CREATE UNIQUE INDEX "BookingSettlement_paymentId_key" ON "BookingSettlement"("paymentId");
CREATE INDEX "BookingSettlement_tenantId_bookingId_idx" ON "BookingSettlement"("tenantId", "bookingId");

ALTER TABLE "BookingSettlement" ADD CONSTRAINT "BookingSettlement_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingSettlement" ADD CONSTRAINT "BookingSettlement_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
