-- Mini shop, slice 1: Product, Sale, SaleItem; SALE as a payment and ledger source;
-- "Shop supplies" as an expense category; shop.sell for existing STAFF.
-- Sale and SaleItem are insert-only by code (no UPDATE or DELETE path). There are no append-only
-- triggers on Payment or LedgerEntry today (ROADMAP F-2), so none are added here either.
-- No FK from Payment or LedgerEntry to Sale (DR-002 §2.14), and none from Sale to Booking.

-- AlterEnum
ALTER TYPE "PaymentSourceType" ADD VALUE 'SALE';

-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'SHOP_SUPPLIES';

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceUsd" DECIMAL(12,2) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Product_priceUsd_positive" CHECK ("priceUsd" > 0)
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdByMembershipId" TEXT NOT NULL,
    "bookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceUsd" DECIMAL(12,2) NOT NULL,
    "lineTotalUsd" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SaleItem_qty_range" CHECK ("qty" BETWEEN 1 AND 99),
    CONSTRAINT "SaleItem_unitPriceUsd_positive" CHECK ("unitPriceUsd" > 0),
    CONSTRAINT "SaleItem_lineTotal_matches" CHECK ("lineTotalUsd" = "qty" * "unitPriceUsd")
);

-- CreateIndex
CREATE INDEX "Product_tenantId_idx" ON "Product"("tenantId");

-- CreateIndex
CREATE INDEX "Product_tenantId_archivedAt_idx" ON "Product"("tenantId", "archivedAt");

-- CreateIndex
CREATE INDEX "Sale_tenantId_idx" ON "Sale"("tenantId");

-- CreateIndex
CREATE INDEX "Sale_tenantId_soldAt_idx" ON "Sale"("tenantId", "soldAt");

-- CreateIndex
CREATE INDEX "SaleItem_tenantId_idx" ON "SaleItem"("tenantId");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_tenantId_productId_idx" ON "SaleItem"("tenantId", "productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_createdByMembershipId_fkey" FOREIGN KEY ("createdByMembershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Permissions are stored per membership row (jsonb flags, strictly true). STAFF may sell by
-- default, so every existing STAFF row gets shop.sell. shop.manage is owner-only: no flag grants it.
UPDATE "Membership"
SET "permissions" = "permissions" || '{"shop.sell": true}'::jsonb
WHERE "role" = 'STAFF';
