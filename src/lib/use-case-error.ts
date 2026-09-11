import { ZodError } from "zod";
import { DomainError, UnexpectedError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { safeTenantId } from "@/lib/tenant-context";

/**
 * Use-case catch-all (SPEC-12 step 5). DomainError is a product outcome — rethrow,
 * do not log. Anything else is a bug: log useCase + tenant if cheap, wrap.
 */
export async function rethrowUnexpected(
  error: unknown,
  message: string,
  useCase: string,
): Promise<never> {
  if (error instanceof DomainError) throw error;
  if (error instanceof UnexpectedError) throw error;
  const tenantId = await safeTenantId();
  logger.error(message, error, { useCase, tenantId });
  throw new UnexpectedError(error);
}

/**
 * Server Action catch (SPEC-12 step 6). Domain → key. Zod → form.invalid.
 * UnexpectedError is already logged in the use case. Log only if still raw.
 */
export async function actionErrorKey(
  error: unknown,
  useCase: string,
): Promise<string> {
  if (error instanceof DomainError) return error.key;
  if (error instanceof ZodError) return "form.invalid";
  if (!(error instanceof UnexpectedError)) {
    logger.error(`${useCase} failed`, error, {
      useCase,
      tenantId: await safeTenantId(),
    });
  }
  return "error.generic";
}
