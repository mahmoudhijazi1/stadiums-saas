import Decimal from "decimal.js";
import type { PaymentSourceType } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/format/money";
import { getCurrentTenantId } from "@/lib/tenant-context";

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

/**
 * Credit part of a payment to participants (SPEC-15). Payment does not know what a
 * participant is — the caller passes ids it already checked. Tenant is stamped by the guard.
 */
export async function insertAllocations(
  tx: TenantTx,
  paymentId: string,
  allocations: { participantId: string; amountUsd: Decimal }[],
): Promise<void> {
  for (const allocation of allocations) {
    await tx.paymentAllocation.create({
      data: {
        paymentId,
        participantId: allocation.participantId,
        amountUsd: formatUsd(allocation.amountUsd),
      } as Parameters<typeof tx.paymentAllocation.create>[0]["data"],
    });
  }
}

export type TenderRow = {
  sourceId: string;
  currency: "USD" | "LBP";
  amount: Decimal;
  rateAtTime: Decimal | null;
  usdEquivalent: Decimal;
};

/** Every tender of the payments of these sources, one query. Payment does not know what a source is. */
export async function listTendersBySourceIds(
  tx: TenantTx,
  sourceType: PaymentSourceType,
  sourceIds: string[],
): Promise<TenderRow[]> {
  if (sourceIds.length === 0) return [];
  const payments = await tx.payment.findMany({
    where: { sourceType, sourceId: { in: sourceIds } },
    orderBy: { createdAt: "asc" },
    select: {
      sourceId: true,
      tenders: {
        select: { currency: true, amount: true, rateAtTime: true, usdEquivalent: true },
        orderBy: { id: "asc" },
      },
    },
  });
  return payments.flatMap((payment) =>
    payment.tenders.map((tender) => ({
      sourceId: payment.sourceId,
      currency: tender.currency,
      amount: new Decimal(tender.amount.toString()),
      rateAtTime: tender.rateAtTime ? new Decimal(tender.rateAtTime.toString()) : null,
      usdEquivalent: new Decimal(tender.usdEquivalent.toString()),
    })),
  );
}

export type CashTenderTotal = { direction: "IN" | "OUT"; currency: "USD" | "LBP"; amount: Decimal };

/**
 * What physically changed hands in a window, per direction and currency, from the tenders as
 * recorded (never converted): one GROUP BY. The window is the moment each payment was recorded
 * (`Payment.createdAt`). An EXPENSE payment is money OUT; BOOKING and SALE payments are money IN
 * (the same rule `recordPayment` writes the ledger with). Change handed back at the counter is
 * never recorded as a tender, so it is not counted. Raw SQL: the tenant is stamped by hand.
 */
export async function sumTendersByDirectionAndCurrency(
  tx: TenantTx,
  startInclusive: Date,
  endExclusive: Date,
): Promise<CashTenderTotal[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ direction: "IN" | "OUT"; currency: "USD" | "LBP"; amount: string }[]>`
    SELECT CASE WHEN p."sourceType" = 'EXPENSE'::"PaymentSourceType" THEN 'OUT' ELSE 'IN' END AS direction,
           t.currency::text AS currency,
           SUM(t.amount)::text AS amount
    FROM "PaymentTender" t
    JOIN "Payment" p ON p.id = t."paymentId" AND p."tenantId" = ${tenantId}
    WHERE t."tenantId" = ${tenantId}
      AND p."createdAt" >= ${startInclusive} AND p."createdAt" < ${endExclusive}
    GROUP BY 1, 2`;
  return rows.map((row) => ({ direction: row.direction, currency: row.currency, amount: new Decimal(row.amount) }));
}
