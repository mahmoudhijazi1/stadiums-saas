import Decimal from "decimal.js";
import type {
  LedgerDirection,
  PaymentSourceType,
} from "@/app/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { formatUsd } from "@/lib/money";

/**
 * Append-only USD movement. Same source as the payment (DR-002 §2.21).
 * Omit tenantId — the guard stamps it. Never update or delete.
 */
export async function insertLedgerEntry(
  tx: TenantTx,
  input: {
    direction: LedgerDirection;
    amountUsd: Decimal;
    sourceType: PaymentSourceType;
    sourceId: string;
    occurredAt?: Date;
  },
) {
  return tx.ledgerEntry.create({
    data: {
      direction: input.direction,
      amountUsd: formatUsd(input.amountUsd),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
    } as Parameters<typeof tx.ledgerEntry.create>[0]["data"],
  });
}

/**
 * Period totals for the URL tenant (SPEC-08). SUM amount_usd GROUP BY direction.
 * No sourceType filter — shop later must appear without editing this WHERE.
 * Guard stamps tenantId; never pass it. Prisma 7 groupBy: by + _sum (generated LedgerEntry).
 */
export async function sumAmountUsdByDirection(
  tx: TenantTx,
  startInclusive: Date,
  endExclusive: Date,
): Promise<{ IN: Decimal; OUT: Decimal }> {
  const groups = await tx.ledgerEntry.groupBy({
    by: ["direction"],
    where: {
      occurredAt: {
        gte: startInclusive,
        lt: endExclusive,
      },
    },
    _sum: { amountUsd: true },
  });

  const totals = { IN: new Decimal("0.00"), OUT: new Decimal("0.00") };
  for (const group of groups) {
    const sum = group._sum.amountUsd;
    totals[group.direction] = new Decimal(sum ? sum.toString() : "0");
  }
  return totals;
}

export type DirectionSourceTotal = {
  direction: "IN" | "OUT";
  sourceType: string;
  usd: Decimal;
  rows: number;
};

/**
 * The same period sums as `sumAmountUsdByDirection`, split by source type, with the row count
 * of each group: one GROUP BY (direction, sourceType). The Money summary derives In, Out, the
 * In-by-source line and "the previous period has rows" from this one read. No sourceType filter,
 * so a future source (academy, ...) appears without editing this query.
 */
export async function sumAmountUsdByDirectionAndSource(
  tx: TenantTx,
  startInclusive: Date,
  endExclusive: Date,
): Promise<DirectionSourceTotal[]> {
  const groups = await tx.ledgerEntry.groupBy({
    by: ["direction", "sourceType"],
    where: { occurredAt: { gte: startInclusive, lt: endExclusive } },
    _sum: { amountUsd: true },
    _count: { _all: true },
  });
  return groups.map((group) => ({
    direction: group.direction,
    sourceType: group.sourceType,
    usd: new Decimal(group._sum.amountUsd ? group._sum.amountUsd.toString() : "0"),
    rows: group._count._all,
  }));
}

export type LedgerEntryRow = {
  id: string;
  direction: "IN" | "OUT";
  amountUsd: Decimal;
  occurredAt: Date;
  sourceType: string;
  sourceId: string;
};

/**
 * One page of ledger movements in a period, newest first. Keyset on (occurredAt, id): the
 * page after a cursor holds rows strictly older, ties on occurredAt broken by id, so a row
 * is never repeated or skipped at a page boundary. `take` includes the extra row the
 * caller uses to know whether there is a next page. Guard stamps tenantId.
 */
export async function listLedgerEntriesPage(
  tx: TenantTx,
  input: {
    startInclusive: Date;
    endExclusive: Date;
    direction?: "IN" | "OUT";
    cursor?: { at: Date; id: string };
    take: number;
  },
): Promise<LedgerEntryRow[]> {
  const rows = await tx.ledgerEntry.findMany({
    where: {
      AND: [
        { occurredAt: { gte: input.startInclusive, lt: input.endExclusive } },
        ...(input.direction ? [{ direction: input.direction }] : []),
        ...(input.cursor
          ? [
              {
                OR: [
                  { occurredAt: { lt: input.cursor.at } },
                  { occurredAt: input.cursor.at, id: { lt: input.cursor.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: input.take,
  });
  return rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    amountUsd: new Decimal(row.amountUsd.toString()),
    occurredAt: row.occurredAt,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
  }));
}
