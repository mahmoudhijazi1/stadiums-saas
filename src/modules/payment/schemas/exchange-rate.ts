import { z } from "zod";
import { isLbpString } from "@/lib/money";

/**
 * Shape of the set-rate form (SPEC-06 step 4).
 * Positive whole LBP per USD (BR-35). Hidden tenant is not in this schema.
 *
 * Zod 4: z.strictObject rejects extra keys.
 */

export const exchangeRateSchema = z.strictObject({
  lbpPerUsd: z
    .string()
    .trim()
    .refine((value) => isLbpString(value) && value !== "0", {
      error: "Rate must be a positive integer (e.g. 90000)",
    }),
});

export type ExchangeRateInput = z.infer<typeof exchangeRateSchema>;

/** Throws ZodError if the rate is missing, zero, or extra keys are sent. */
export function parseExchangeRate(input: unknown): ExchangeRateInput {
  return exchangeRateSchema.parse(input);
}
