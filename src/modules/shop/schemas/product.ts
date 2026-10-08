import Decimal from "decimal.js";
import { z } from "zod";
import { isUsdString, normalizeUsdForm } from "@/lib/money";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";

export const PRODUCT_NAME_MAX = 60;
export const PRODUCT_PRICE_MAX = 10_000;

/**
 * An item at the counter: a name as written (never translated, cleaned with the shared name
 * cleaner, 1 to 60 characters) and a price above 0 and up to 10,000, exact cents.
 */
export const productInputSchema = z.strictObject({
  name: z.string().transform(cleanPersonName).pipe(z.string().min(1).max(PRODUCT_NAME_MAX)),
  priceUsd: z
    .string()
    .trim()
    .transform(normalizeUsdForm)
    .refine((value) => isUsdString(value), { error: "Price must be like 1.50" })
    .refine(
      (value) => {
        const price = new Decimal(value);
        return price.gt(0) && price.lte(PRODUCT_PRICE_MAX);
      },
      { error: "Price must be above 0 and at most 10,000" },
    ),
});

export type ProductInput = z.infer<typeof productInputSchema>;

/** Throws ZodError on a bad name or price. */
export function parseProductInput(input: unknown): ProductInput {
  return productInputSchema.parse(input);
}

export const productIdSchema = z.string().min(1).max(64);
