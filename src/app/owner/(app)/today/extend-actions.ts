"use server";

import { z } from "zod";
import { formatUsd } from "@/lib/format/money";
import { normalizeUsdForm, parseUsd } from "@/lib/format/parse-money";
import { actionErrorKey } from "@/lib/use-case-error";
import { extendBooking } from "@/modules/booking/application/extend-booking";
import type { ExtendActionResult } from "@/modules/booking/ui/action-types";
export type { ExtendActionResult };


const extendSchema = z.strictObject({
  bookingId: z.string().min(1).max(64),
  expectedEndsAt: z.iso.datetime(),
  // Only sent by members who may edit it; the use case decides whether the amount is allowed.
  addedPriceUsd: z.string().max(20).optional(),
});

export async function submitExtendBooking(input: unknown): Promise<ExtendActionResult> {
  try {
    const parsed = extendSchema.parse(input);
    const added = parsed.addedPriceUsd?.trim() ? normalizeUsdForm(parsed.addedPriceUsd.trim()) : undefined;
    const result = await extendBooking({
      bookingId: parsed.bookingId,
      expectedEndsAt: new Date(parsed.expectedEndsAt),
      addedPriceUsd: added === undefined ? undefined : parseUsd(added),
    });
    return {
      ok: true,
      amountDueUsd: formatUsd(result.amountDueUsd),
      addedPriceUsd: formatUsd(result.addedPriceUsd),
      declined: result.declined.length,
    };
  } catch (error) {
    return { error: await actionErrorKey(error, "submitExtendBooking") };
  }
}
