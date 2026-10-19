"use server";

import { z } from "zod";
import { formatUsd } from "@/lib/format/money";
import { isLbpString, normalizeUsdForm, parseLbp, parseUsd } from "@/lib/format/parse-money";
import { DomainError } from "@/lib/errors";
import { actionErrorKey } from "@/lib/use-case-error";
import { extendBooking } from "@/modules/booking/application/extend-booking";
import type { ExtendActionResult } from "@/modules/booking/ui/action-types";
export type { ExtendActionResult };


const extendSchema = z.strictObject({
  bookingId: z.string().min(1).max(64),
  expectedEndsAt: z.iso.datetime(),
  // Only sent by members who may edit it; the use case decides whether the amount is allowed.
  addedPriceUsd: z.string().max(20).optional(),
  // The same for a game priced in pounds: whole pounds.
  addedPriceLbp: z.string().max(20).optional(),
});

export async function submitExtendBooking(input: unknown): Promise<ExtendActionResult> {
  try {
    const parsed = extendSchema.parse(input);
    const added = parsed.addedPriceUsd?.trim() ? normalizeUsdForm(parsed.addedPriceUsd.trim()) : undefined;
    const pounds = parsed.addedPriceLbp?.trim() || undefined;
    if (pounds !== undefined && !isLbpString(pounds)) throw new DomainError("form.invalid");
    const result = await extendBooking({
      bookingId: parsed.bookingId,
      expectedEndsAt: new Date(parsed.expectedEndsAt),
      addedPriceUsd: added === undefined ? undefined : parseUsd(added),
      addedPriceLbp: pounds === undefined ? undefined : parseLbp(pounds),
    });
    const text = (amount: typeof result.amountDue) => (result.currency === "LBP" ? amount.toFixed(0) : formatUsd(amount));
    return {
      ok: true,
      currency: result.currency,
      amountDue: text(result.amountDue),
      addedPrice: text(result.addedPrice),
      declined: result.declined.length,
    };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitExtendBooking") };
  }
}
