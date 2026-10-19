import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import type { LbpTenderSums } from "@/modules/payment/domain/lbp-period";

/**
 * The tenders of a period, summed per source type without crossing currencies (DR-007): LBP tenders
 * as they are, USD tenders with a stored rate as amount x rate (pounds), USD tenders without one as
 * dollars to convert by the caller. The period is the one the ledger uses: an EXPENSE payment by the
 * expense's business date (Expense.occurredAt, the value its ledger row carries; an expense has one
 * payment), a BOOKING or SALE payment by the moment it was recorded (Payment.createdAt, which is its
 * ledger row's time). Raw SQL: the tenant is stamped by hand.
 */
export async function sumTendersInLbpBySource(
  tx: TenantTx,
  startInclusive: Date,
  endExclusive: Date,
): Promise<LbpTenderSums[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { sourceType: string; ratedLbp: string; unratedUsd: string; unrated: number; payments: number }[]
  >`
    SELECT p."sourceType"::text AS "sourceType",
           SUM(CASE WHEN t.currency = 'LBP'::"Currency" THEN t.amount
                    WHEN t."rateAtTime" IS NOT NULL THEN t.amount * t."rateAtTime"
                    ELSE 0 END)::text AS "ratedLbp",
           SUM(CASE WHEN t.currency = 'USD'::"Currency" AND t."rateAtTime" IS NULL THEN t.amount ELSE 0 END)::text AS "unratedUsd",
           COUNT(*) FILTER (WHERE t.currency = 'USD'::"Currency" AND t."rateAtTime" IS NULL)::int AS unrated,
           COUNT(DISTINCT p.id)::int AS payments
    FROM "PaymentTender" t
    JOIN "Payment" p ON p.id = t."paymentId" AND p."tenantId" = ${tenantId}
    LEFT JOIN "Expense" e ON e.id = p."sourceId" AND e."tenantId" = ${tenantId}
                         AND p."sourceType" = 'EXPENSE'::"PaymentSourceType"
    WHERE t."tenantId" = ${tenantId}
      AND (CASE WHEN p."sourceType" = 'EXPENSE'::"PaymentSourceType" THEN e."occurredAt" ELSE p."createdAt" END) >= ${startInclusive}
      AND (CASE WHEN p."sourceType" = 'EXPENSE'::"PaymentSourceType" THEN e."occurredAt" ELSE p."createdAt" END) < ${endExclusive}
    GROUP BY 1`;
  return rows.map((row) => ({
    sourceType: row.sourceType,
    ratedLbp: new Decimal(row.ratedLbp),
    unratedUsd: new Decimal(row.unratedUsd),
    unrated: row.unrated,
    payments: row.payments,
  }));
}

export type PaymentWithTenders = {
  id: string;
  sourceType: string;
  sourceId: string;
  createdAt: Date;
  tenders: { currency: "USD" | "LBP"; amount: Decimal }[];
};

/** The payments (with their tenders) of some sources, one query: the money behind Activity rows. */
export async function listPaymentsOfSources(
  tx: TenantTx,
  sources: readonly { sourceType: "BOOKING" | "EXPENSE" | "SALE" | "KEPT_CHANGE"; sourceId: string }[],
): Promise<PaymentWithTenders[]> {
  if (sources.length === 0) return [];
  const payments = await tx.payment.findMany({
    where: { OR: sources.map((source) => ({ sourceType: source.sourceType, sourceId: source.sourceId })) },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      createdAt: true,
      tenders: { select: { currency: true, amount: true } },
    },
  });
  return payments.map((payment) => ({
    id: payment.id,
    sourceType: payment.sourceType,
    sourceId: payment.sourceId,
    createdAt: payment.createdAt,
    tenders: payment.tenders.map((tender) => ({ currency: tender.currency, amount: new Decimal(tender.amount.toString()) })),
  }));
}
