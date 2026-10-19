import { z } from "zod";
import { MAX_PLAYER_SLOTS } from "@/modules/booking/domain/build-slots";

/**
 * Inputs of the per-player actions (SPEC-15 slice 2). Called with plain arguments,
 * not FormData, so the sheet can stay open. Zod 4: strictObject rejects extra keys.
 */

const bookingId = z.string().trim().min(1);

export const switchToPerPlayerSchema = z.strictObject({
  bookingId,
  count: z.coerce.number().int().min(1).max(MAX_PLAYER_SLOTS),
});

export const switchToWholeSchema = z.strictObject({ bookingId });

/**
 * The cash typed for a game in pounds (DR-007 slice 7): digits as the two-currency form sends them.
 * Both empty means "exactly what is charged, in pounds". A game in dollars ignores them.
 */
const cash = {
  usdAmount: z.string().trim().max(20).optional(),
  lbpAmount: z.string().trim().max(20).optional(),
  /** Keep the change as its own payment instead of giving it back (DR-007 decision 15). */
  keepChange: z.boolean().optional(),
};

export const collectSlotSchema = z.strictObject({
  bookingId,
  participantId: z.string().trim().min(1),
  ...cash,
});

export const collectAllRemainingSchema = z.strictObject({ bookingId, ...cash });

export const considerSharePaidSchema = z.strictObject({
  bookingId,
  participantId: z.string().trim().min(1),
});
