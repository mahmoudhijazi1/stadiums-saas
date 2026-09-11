-- SPEC-07 step 1: Expense (no amount — money is a Payment) + PaymentSourceType.EXPENSE.
-- tenantId required (DR-001). No FK from Payment to Expense (DR-002 §2.14 / §2.22).

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('ELECTRICITY', 'WATER', 'MAINTENANCE', 'SALARY', 'EQUIPMENT', 'OTHER');

-- AlterEnum
ALTER TYPE "PaymentSourceType" ADD VALUE 'EXPENSE';

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_tenantId_idx" ON "Expense"("tenantId");

-- CreateIndex
CREATE INDEX "Expense_tenantId_occurredAt_idx" ON "Expense"("tenantId", "occurredAt");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
