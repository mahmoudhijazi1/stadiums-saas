import { z } from "zod";
import {
  isLbpString,
  isUsdString,
  normalizeUsdForm,
  parseLbp,
  parseUsd,
} from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/modules/expense/domain/categories";

/**
 * Shape of the record-expense form (SPEC-07 step 4).
 * Hidden tenant slug is not isolation — omit it here.
 * Amounts stay strings; domain freezes equivalents later.
 *
 * Zod 4: z.strictObject rejects extra keys.
 * Refine must not call parseUsd/parseLbp unless the string already matches —
 * those helpers throw Error, not ZodError (SPEC-06 correction).
 */

const CIVIL_DAY = /^\d{4}-\d{2}-\d{2}$/;

function blankToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function usdForm(value: string | undefined): string | undefined {
  const trimmed = blankToUndefined(value);
  return trimmed === undefined ? undefined : normalizeUsdForm(trimmed);
}

export const recordExpenseSchema = z
  .strictObject({
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string().trim().min(1).max(200),
    occurredOn: z.string().regex(CIVIL_DAY),
    usdAmount: z
      .string()
      .optional()
      .transform(usdForm)
      .refine((value) => value === undefined || isUsdString(value), {
        error: "USD must be like 30.00",
      }),
    lbpAmount: z
      .string()
      .optional()
      .transform(blankToUndefined)
      .refine((value) => value === undefined || isLbpString(value), {
        error: "LBP must be a whole-pound integer",
      }),
  })
  .refine(
    (data) => {
      const usdOk =
        data.usdAmount !== undefined &&
        isUsdString(data.usdAmount) &&
        parseUsd(data.usdAmount).gt(0);
      const lbpOk =
        data.lbpAmount !== undefined &&
        isLbpString(data.lbpAmount) &&
        parseLbp(data.lbpAmount).gt(0);
      return usdOk || lbpOk;
    },
    { error: "Amount required" },
  );

export type RecordExpenseInput = z.infer<typeof recordExpenseSchema>;

/** Throws ZodError if category/description/date/amounts are missing, malformed, or extra keys. */
export function parseRecordExpense(input: unknown): RecordExpenseInput {
  return recordExpenseSchema.parse(input);
}
