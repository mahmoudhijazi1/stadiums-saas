import { z } from "zod";

/**
 * Shape of approve/reject forms (SPEC-05 step 4).
 * Hidden tenant slug is not isolation — omit it here (same as login / public request).
 *
 * Zod 4: z.strictObject rejects extra keys.
 */

export const bookingDecisionSchema = z.strictObject({
  bookingId: z.string().trim().min(1),
});

export type BookingDecision = z.infer<typeof bookingDecisionSchema>;

/** Throws ZodError if bookingId is missing/blank or extra keys are sent. */
export function parseBookingDecision(input: unknown): BookingDecision {
  return bookingDecisionSchema.parse(input);
}
