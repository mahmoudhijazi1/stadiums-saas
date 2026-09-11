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
  },
) {
  return tx.ledgerEntry.create({
    data: {
      direction: input.direction,
      amountUsd: formatUsd(input.amountUsd),
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    } as Parameters<typeof tx.ledgerEntry.create>[0]["data"],
  });
}
