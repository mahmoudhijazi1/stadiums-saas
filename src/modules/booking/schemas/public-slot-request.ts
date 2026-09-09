import { z } from "zod";
import { normalizePhone } from "@/modules/people/domain/phone";

/**
 * Shape of the public request form (SPEC-03 step 6).
 * Parse this before the use case. Slot truth and price still live in domain (step 5).
 *
 * Zod 4: z.iso.datetime() is UTC with Z (no offset). z.strictObject rejects extra keys.
 * https://zod.dev/api
 */

const isoUtc = z.iso.datetime();

const phoneDigits = z
  .string()
  .transform(normalizePhone)
  .refine((digits) => digits.length >= 8 && digits.length <= 15, {
    error: "Phone must be 8–15 digits after removing spaces, dashes, and +",
  });

export const publicSlotRequestSchema = z.strictObject({
  name: z.string().trim().min(1),
  phone: phoneDigits,
  pitchId: z.string().min(1),
  start: isoUtc,
  end: isoUtc,
});

export type PublicSlotRequest = z.infer<typeof publicSlotRequestSchema>;

/** Throws ZodError if the form is missing fields, has a bad phone, or extra keys. */
export function parsePublicSlotRequest(input: unknown): PublicSlotRequest {
  return publicSlotRequestSchema.parse(input);
}
