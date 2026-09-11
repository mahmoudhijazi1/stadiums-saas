/**
 * Expected product outcomes vs bugs (DR-004). Throw DomainError with a key;
 * copy lives in error-messages.ts. Never leak Prisma dumps to app/.
 */
export class DomainError extends Error {
  readonly key: string;

  constructor(key: string) {
    super(key);
    this.name = "DomainError";
    this.key = key;
  }
}

/**
 * Wraps anything unexpected. Log the cause; the owner only sees error.generic.
 */
export class UnexpectedError extends Error {
  constructor(cause: unknown) {
    const message =
      cause instanceof Error ? cause.message : String(cause);
    super(message, { cause });
    this.name = "UnexpectedError";
  }
}
