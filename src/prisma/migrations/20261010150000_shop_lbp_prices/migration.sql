-- Mini shop: items priced in LBP.
-- An item has a price currency. A USD item keeps priceUsd (Decimal 12,2); an LBP item has priceLbp
-- (whole pounds, > 0, BigInt) and no priceUsd. A sale line keeps its frozen USD value (for every
-- report) plus, for an LBP item, the LBP price, the LBP line total and the rate it was frozen at.
-- What a sale or tab owes is tracked in each currency by SaleAllocation: one insert-only row per
-- payment, saying how much of the LBP part and of the USD part that payment settled.

-- Product ----------------------------------------------------------------------------------------
ALTER TABLE "Product"
  ADD COLUMN "priceCurrency" "Currency" NOT NULL DEFAULT 'USD',
  ADD COLUMN "priceLbp" BIGINT,
  ALTER COLUMN "priceUsd" DROP NOT NULL;

ALTER TABLE "Product" ADD CONSTRAINT "Product_price_by_currency" CHECK (
  ("priceCurrency" = 'USD' AND "priceUsd" IS NOT NULL AND "priceUsd" > 0 AND "priceLbp" IS NULL)
  OR ("priceCurrency" = 'LBP' AND "priceLbp" IS NOT NULL AND "priceLbp" > 0 AND "priceUsd" IS NULL)
);

-- SaleItem ---------------------------------------------------------------------------------------
ALTER TABLE "SaleItem"
  ADD COLUMN "unitPriceLbp" DECIMAL(18,0),
  ADD COLUMN "lineTotalLbp" DECIMAL(18,0),
  ADD COLUMN "rateAtTime" DECIMAL(18,0);

-- An LBP line has all three LBP fields; a USD line has none.
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_lbp_fields_together" CHECK (
  ("unitPriceLbp" IS NULL AND "lineTotalLbp" IS NULL AND "rateAtTime" IS NULL)
  OR ("unitPriceLbp" > 0 AND "lineTotalLbp" IS NOT NULL AND "rateAtTime" > 0)
);

-- USD line: the total is qty x unit price, as before. LBP line: the LBP total is qty x the LBP unit
-- price; its frozen USD value is the conversion of the net LBP total, so it is not qty x a rounded unit.
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_lineTotal_matches";
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_lineTotal_matches" CHECK (
  ("unitPriceLbp" IS NULL AND "lineTotalUsd" = "qty" * "unitPriceUsd")
  OR ("unitPriceLbp" IS NOT NULL AND "lineTotalLbp" = "qty" * "unitPriceLbp")
);

-- The unit USD value of an LBP item can round to 0.00 at a high rate.
ALTER TABLE "SaleItem" DROP CONSTRAINT "SaleItem_unitPriceUsd_positive";
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_unitPriceUsd_positive" CHECK (
  ("unitPriceLbp" IS NULL AND "unitPriceUsd" > 0) OR ("unitPriceLbp" IS NOT NULL AND "unitPriceUsd" >= 0)
);

-- A reversal copies the original's prices (USD and LBP) and rate.
CREATE OR REPLACE FUNCTION "SaleItem_check_reversal"() RETURNS trigger AS $$
DECLARE
  original RECORD;
  net INTEGER;
BEGIN
  IF NEW."reversesItemId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "saleId", "productId", "qty", "unitPriceUsd", "unitPriceLbp", "rateAtTime" INTO original
    FROM "SaleItem" WHERE "id" = NEW."reversesItemId";
  IF NOT FOUND
     OR original."saleId" <> NEW."saleId"
     OR original."productId" <> NEW."productId"
     OR original."qty" <= 0
     OR original."unitPriceUsd" <> NEW."unitPriceUsd"
     OR original."unitPriceLbp" IS DISTINCT FROM NEW."unitPriceLbp"
     OR original."rateAtTime" IS DISTINCT FROM NEW."rateAtTime" THEN
    RAISE EXCEPTION 'SaleItem reversal must reverse a positive line of the same sale, item, price and rate';
  END IF;
  SELECT original."qty" + COALESCE(SUM("qty"), 0) INTO net
    FROM "SaleItem" WHERE "reversesItemId" = NEW."reversesItemId";
  IF net + NEW."qty" < 0 THEN
    RAISE EXCEPTION 'SaleItem reversal would take the net quantity below zero';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- SaleAllocation ---------------------------------------------------------------------------------
-- How much of a sale's LBP part and USD part each payment settled (insert-only). The remaining LBP
-- owed is the sum of the LBP lines minus the sum of lbpApplied; likewise for USD. paymentId has no
-- foreign key (Payment does not know what a source is, DR-002 §2.14).
CREATE TABLE "SaleAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "lbpApplied" DECIMAL(18,0) NOT NULL,
    "usdApplied" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SaleAllocation_nonneg" CHECK ("lbpApplied" >= 0 AND "usdApplied" >= 0)
);

CREATE UNIQUE INDEX "SaleAllocation_paymentId_key" ON "SaleAllocation"("paymentId");
CREATE INDEX "SaleAllocation_tenantId_idx" ON "SaleAllocation"("tenantId");
CREATE INDEX "SaleAllocation_saleId_idx" ON "SaleAllocation"("saleId");

ALTER TABLE "SaleAllocation" ADD CONSTRAINT "SaleAllocation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleAllocation" ADD CONSTRAINT "SaleAllocation_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Every sale that exists priced everything in USD, so each of its payments settled exactly the USD it
-- recorded (an LBP tender was converted at its frozen rate when it was taken).
INSERT INTO "SaleAllocation" ("id", "tenantId", "saleId", "paymentId", "lbpApplied", "usdApplied", "createdAt")
SELECT
  'sa_' || p."id", p."tenantId", p."sourceId", p."id", 0,
  COALESCE((SELECT SUM(t."usdEquivalent") FROM "PaymentTender" t WHERE t."paymentId" = p."id"), 0),
  p."createdAt"
FROM "Payment" p
WHERE p."sourceType" = 'SALE'
  AND EXISTS (SELECT 1 FROM "Sale" s WHERE s."id" = p."sourceId");
