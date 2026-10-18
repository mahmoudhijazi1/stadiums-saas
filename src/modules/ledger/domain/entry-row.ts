import type Decimal from "decimal.js";

export type LedgerEntryRow = {
  id: string;
  direction: "IN" | "OUT";
  amountUsd: Decimal;
  occurredAt: Date;
  sourceType: string;
  sourceId: string;
  /** The payment the row was written for; null on rows written before F-2 (no backfill). */
  paymentId?: string | null;
};
