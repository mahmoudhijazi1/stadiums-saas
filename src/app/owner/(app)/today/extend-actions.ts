"use server";

import { z } from "zod";
import { formatUsd } from "@/lib/format/money";
import { normalizeUsdForm, parseUsd } from "@/lib/format/parse-money";
import { actionErrorKey } from "@/lib/use-case-error";
import { extendBooking } from "@/modules/booking/application/extend-booking";

/**
 * Extend a game by 30 minutes. Returns a result instead of redirecting: the confirm sheet stays
 * open and shows the new range and the new due. The user and the permission come from the session
 * inside the use case; `expectedEndsAt` is the end the owner saw (a double tap adds 30 minutes once).
 */
export type ExtendActionResult =
  | { ok: true; amountDueUsd: string; addedPriceUsd: string; declined: number }
  | { error: string };

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
