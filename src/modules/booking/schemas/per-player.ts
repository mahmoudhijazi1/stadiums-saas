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

export const collectSlotSchema = z.strictObject({
  bookingId,
  participantId: z.string().trim().min(1),
});

export const collectAllRemainingSchema = z.strictObject({ bookingId });
