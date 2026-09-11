import Decimal from "decimal.js";
import type { PaymentSourceType } from "@/app/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/money";

export type TenderInsert = {
  currency: "USD" | "LBP";
  amount: Decimal;
  rateAtTime: Decimal | null;
  usdEquivalent: Decimal;
};

/**
 * One collection: payment row + its tenders. Same tx as the ledger write (caller).
 * Omit tenantId — the guard stamps both tables (DR-001 / Chapter 39).
 */
export async function insertPaymentWithTenders(
  tx: TenantTx,
  input: {
    sourceType: PaymentSourceType;
    sourceId: string;
    amountDueUsd: Decimal;
    tenders: TenderInsert[];
  },
): Promise<string> {
  const payment = await tx.payment.create({
    data: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      amountDueUsd: formatUsd(input.amountDueUsd),
    } as Parameters<typeof tx.payment.create>[0]["data"],
  });

  for (const tender of input.tenders) {
    await tx.paymentTender.create({
      data: {
        paymentId: payment.id,
        currency: tender.currency,
        amount:
          tender.currency === "USD"
            ? formatUsd(tender.amount)
            : tender.amount.toFixed(0),
        rateAtTime: tender.rateAtTime ? tender.rateAtTime.toFixed(0) : null,
        usdEquivalent: formatUsd(tender.usdEquivalent),
      } as Parameters<typeof tx.paymentTender.create>[0]["data"],
    });
  }

  return payment.id;
}

/**
 * Sum of frozen USD equivalents for this source (remaining = price − this).
 * Payment does not know what a booking is — only sourceType + sourceId.
 */
export async function sumCollectedUsd(
  tx: TenantTx,
  sourceType: PaymentSourceType,
  sourceId: string,
): Promise<Decimal> {
  const payments = await tx.payment.findMany({
    where: { sourceType, sourceId },
    select: { tenders: { select: { usdEquivalent: true } } },
  });

  let total = new Decimal(0);
  for (const payment of payments) {
    for (const tender of payment.tenders) {
      total = total.plus(tender.usdEquivalent.toString());
    }
  }
  return total;
}

/**
 * Collected USD per source id (bookings or expenses). Missing ids → 0.
 * Payment still does not know what the source row is.
 */
export async function sumCollectedUsdBySourceIds(
  tx: TenantTx,
  sourceType: PaymentSourceType,
  sourceIds: string[],
): Promise<Map<string, Decimal>> {
  const totals = new Map<string, Decimal>();
  for (const id of sourceIds) {
    totals.set(id, new Decimal(0));
  }
  if (sourceIds.length === 0) return totals;

  const payments = await tx.payment.findMany({
    where: { sourceType, sourceId: { in: sourceIds } },
    select: {
      sourceId: true,
      tenders: { select: { usdEquivalent: true } },
    },
  });

  for (const payment of payments) {
    let add = new Decimal(0);
    for (const tender of payment.tenders) {
      add = add.plus(tender.usdEquivalent.toString());
    }
    totals.set(payment.sourceId, (totals.get(payment.sourceId) ?? new Decimal(0)).plus(add));
  }

  return totals;
}
