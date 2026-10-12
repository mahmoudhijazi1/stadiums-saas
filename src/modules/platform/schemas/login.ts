import { z } from "zod";

/**
 * The admin login form: three strings with sane caps. The use case folds the identifier; a
 * failure here is shown as the same generic login error (nothing says which field was wrong).
 */
const loginSchema = z.strictObject({
  identifier: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
  code: z.string().min(1).max(12),
});

export type PlatformLoginInput = z.infer<typeof loginSchema>;

export function parsePlatformLogin(input: unknown): PlatformLoginInput {
  return loginSchema.parse(input);
}
