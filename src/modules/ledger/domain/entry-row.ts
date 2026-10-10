import type Decimal from "decimal.js";

export type LedgerEntryRow = {
  id: string;
  direction: "IN" | "OUT";
  amountUsd: Decimal;
  occurredAt: Date;
  sourceType: string;
  sourceId: string;
};
