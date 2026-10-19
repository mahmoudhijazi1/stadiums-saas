import { z } from "zod";

/** The owner's "Game prices in" form: exactly one of the two currencies (DR-007 decision 1). */
const gameCurrencyFormSchema = z.strictObject({ currency: z.enum(["USD", "LBP"]) });

export function parseGameCurrencyForm(raw: unknown): { currency: "USD" | "LBP" } {
  return gameCurrencyFormSchema.parse(raw);
}

/** The other currency: what the confirm sheet offers to switch to. */
export function otherGameCurrency(current: "USD" | "LBP"): "USD" | "LBP" {
  return current === "USD" ? "LBP" : "USD";
}
