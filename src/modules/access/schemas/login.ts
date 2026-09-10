import { z } from "zod";
import {
  normalizeIdentifier,
  parseLoginIdentifier,
} from "@/modules/access/domain/identifier";

/**
 * Shape of the login form (SPEC-04 step 4). Parse before the use case.
 * Password is not hashed here — that is application/infra later.
 *
 * Zod 4: z.strictObject rejects extra keys.
 */

export const loginSchema = z.strictObject({
  identifier: z
    .string()
    .transform(normalizeIdentifier)
    .refine((value) => parseLoginIdentifier(value) !== null, {
      error: "Use local@stadium (e.g. owner@ahmad), not an email inbox",
    }),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Throws ZodError if identifier/password is missing, malformed, or extra keys. */
export function parseLogin(input: unknown): LoginInput {
  return loginSchema.parse(input);
}
