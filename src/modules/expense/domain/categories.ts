/**
 * Fixed expense kinds (DR-002 §2.23 / BR-51). Not a Prisma import —
 * domain stays free of the Client. Zod will reuse this list.
 */
export const EXPENSE_CATEGORIES = [
  "ELECTRICITY",
  "WATER",
  "MAINTENANCE",
  "SALARY",
  "EQUIPMENT",
  "OTHER",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
