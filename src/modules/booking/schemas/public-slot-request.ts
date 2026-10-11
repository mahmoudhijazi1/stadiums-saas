import { z } from "zod";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";
import { toCanonicalPhone } from "@/modules/people/domain/phone";

/**
 * Shape of the public request form (SPEC-03 step 6).
 * Parse this before the use case. Slot truth and price still live in domain (step 5).
 *
 * The phone is turned into its canonical form here, at the edge (`toCanonicalPhone`, with the
 * optional `country`, default Lebanon); everything after receives the canonical phone. A phone
 * that cannot be canonical, or an unknown country, is a ZodError on `phone`.
 *
 * Zod 4: z.iso.datetime() is UTC with Z (no offset). z.strictObject rejects extra keys.
 * https://zod.dev/api
 */

const isoUtc = z.iso.datetime();

/** Security audit S-5 / S-14: the shared cleaner first, then 1–60 characters. */
export const PUBLIC_NAME_MAX = 60;

export const publicSlotRequestSchema = z
  .strictObject({
    name: z.string().transform(cleanPersonName).pipe(z.string().min(1).max(PUBLIC_NAME_MAX)),
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

export type PublicSlotRequest = z.infer<typeof publicSlotRequestSchema>;

/** Throws ZodError if the form is missing fields, has a bad phone, or extra keys. */
export function parsePublicSlotRequest(input: unknown): PublicSlotRequest {
  return publicSlotRequestSchema.parse(input);
}
