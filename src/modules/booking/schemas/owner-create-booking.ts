import { z } from "zod";
import { normalizePhone } from "@/modules/people/domain/phone";

/**
 * Shape of the owner Book form (SPEC-09 step 2).
 * Parse this before the use case. Slot truth and price still live in domain.
 * Hidden tenant slug is not isolation — omit it here.
 *
 * Zod 4: z.iso.datetime() is UTC with Z (no offset). z.strictObject rejects extra keys
 * (including price — owner cannot type a price this slice).
 */

const isoUtc = z.iso.datetime();

const phoneDigits = z
  .string()
  .transform(normalizePhone)
  .refine((digits) => digits.length >= 8 && digits.length <= 15, {
    error: "Phone must be 8–15 digits after removing spaces, dashes, and +",
  });

export const ownerCreateBookingSchema = z.strictObject({
  name: z.string().trim().min(1),
  phone: phoneDigits,
  pitchId: z.string().min(1),
  start: isoUtc,
  end: isoUtc,
});

export type OwnerCreateBooking = z.infer<typeof ownerCreateBookingSchema>;

/** Throws ZodError if the form is missing fields, has a bad phone, a price, or extra keys. */
export function parseOwnerCreateBooking(input: unknown): OwnerCreateBooking {
  return ownerCreateBookingSchema.parse(input);
}
