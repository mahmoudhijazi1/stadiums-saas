import { z } from "zod";
import { toCanonicalPhone } from "@/modules/people/domain/phone";

/**
 * Shape of the owner Book form (SPEC-09 step 2).
 * Parse this before the use case. Slot truth and price still live in domain.
 * Hidden tenant slug is not isolation — omit it here.
 *
 * The phone becomes canonical here (`toCanonicalPhone`, optional `country`, default Lebanon); the
 * use case receives the canonical phone. A bad phone or an unknown country is a ZodError on `phone`.
 *
 * Zod 4: z.iso.datetime() is UTC with Z (no offset). z.strictObject rejects extra keys
 * (including price — owner cannot type a price this slice).
 */

const isoUtc = z.iso.datetime();

export const ownerCreateBookingSchema = z
  .strictObject({
    name: z.string().trim().min(1),
    phone: z.string(),
    country: z.string().optional(),
    pitchId: z.string().min(1),
    start: isoUtc,
    end: isoUtc,
  })
  .superRefine((value, ctx) => {
    if (toCanonicalPhone(value.phone, value.country) === null) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Phone is not a valid number for this country" });
    }
  })
  .transform((value) => ({
    name: value.name,
    phone: toCanonicalPhone(value.phone, value.country)!,
    pitchId: value.pitchId,
    start: value.start,
    end: value.end,
  }));

export type OwnerCreateBooking = z.infer<typeof ownerCreateBookingSchema>;

/** Throws ZodError if the form is missing fields, has a bad phone, a price, or extra keys. */
export function parseOwnerCreateBooking(input: unknown): OwnerCreateBooking {
  return ownerCreateBookingSchema.parse(input);
}
