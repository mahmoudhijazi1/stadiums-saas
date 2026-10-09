import Decimal from "decimal.js";
import { z } from "zod";
import { isLbpString, isUsdString, normalizeUsdForm } from "@/lib/money";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";
import type { ItemPrice } from "@/modules/shop/domain/pricing";

export const PRODUCT_NAME_MAX = 60;
export const PRODUCT_PRICE_MAX = 10_000;
export const PRODUCT_PRICE_LBP_MAX = 1_000_000_000;

const name = z.string().transform(cleanPersonName).pipe(z.string().min(1).max(PRODUCT_NAME_MAX));

/**
 * An item at the counter: a name as written (never translated, cleaned with the shared name
 * cleaner, 1 to 60 characters) and ONE price, in dollars (`priceUsd`, above 0 and up to 10,000,
 * exact cents) or in pounds (`priceLbp`, whole, above 0 and up to 1,000,000,000).
 */
export const productInputSchema = z.union([
  z.strictObject({
    name,
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
  }),
  z.strictObject({
    name,
    priceLbp: z
      .string()
      .trim()
      .refine((value) => isLbpString(value), { error: "Price must be whole pounds" })
      .refine(
        (value) => {
          const price = new Decimal(value);
          return price.gt(0) && price.lte(PRODUCT_PRICE_LBP_MAX);
        },
        { error: "Price must be above 0 and at most 1,000,000,000" },
      ),
  }),
]);

export type ProductInput = { name: string; price: ItemPrice };

/** Throws ZodError on a bad name or price. */
export function parseProductInput(input: unknown): ProductInput {
  const parsed = productInputSchema.parse(input);
  return "priceUsd" in parsed
    ? { name: parsed.name, price: { currency: "USD", usd: new Decimal(parsed.priceUsd) } }
    : { name: parsed.name, price: { currency: "LBP", lbp: new Decimal(parsed.priceLbp) } };
}

export const productIdSchema = z.string().min(1).max(64);
