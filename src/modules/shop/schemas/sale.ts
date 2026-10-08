import { z } from "zod";
import { isLbpString, isUsdString, normalizeUsdForm } from "@/lib/money";
import { MAX_LINES, QTY_MAX, QTY_MIN } from "@/modules/shop/domain/sale";

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * A walk-in sale as the sell screen sends it: item ids and quantities (never prices: the
 * server reads them), and what was handed over in USD and/or LBP.
 */
export const walkInSaleSchema = z.strictObject({
  lines: z
    .array(
      z.strictObject({
        productId: z.string().min(1).max(64),
        qty: z.number().int().min(QTY_MIN).max(QTY_MAX),
      }),
    )
    .min(1)
    .max(MAX_LINES),
  usdAmount: z
    .string()
    .optional()
    .transform(blankToUndefined)
    .transform((value) => (value === undefined ? undefined : normalizeUsdForm(value)))
    .refine((value) => value === undefined || isUsdString(value), { error: "USD must be like 5.00" }),
  lbpAmount: z
    .string()
    .optional()
    .transform(blankToUndefined)
    .refine((value) => value === undefined || isLbpString(value), { error: "LBP must be whole pounds" }),
});

export type WalkInSaleInput = z.infer<typeof walkInSaleSchema>;

/** Throws ZodError for a malformed request. */
export function parseWalkInSale(input: unknown): WalkInSaleInput {
  return walkInSaleSchema.parse(input);
}
