import Decimal from "decimal.js";
import type { TenantTx } from "@/lib/db";

/**
 * Latest LBP-per-USD for this tenant (append-only table; current = newest row).
 * Guard injects tenantId — do not pass it (DR-001).
 */
export async function findLatestExchangeRate(
  tx: TenantTx,
): Promise<Decimal | null> {
  const row = await tx.exchangeRate.findFirst({
    orderBy: { createdAt: "desc" },
    select: { lbpPerUsd: true },
  });
  if (!row) return null;
  return new Decimal(row.lbpPerUsd.toString());
}

/**
 * Append a new rate row. Old tenders keep their frozen rate (DR-002 §2.17).
 * Omit tenantId — the extension stamps it (Prisma 7 create XOR, same as participants).
 */
export async function insertExchangeRate(
  tx: TenantTx,
  lbpPerUsd: Decimal,
) {
  return tx.exchangeRate.create({
    data: { lbpPerUsd: lbpPerUsd.toFixed(0) } as Parameters<
      typeof tx.exchangeRate.create
    >[0]["data"],
  });
}
