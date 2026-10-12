/**
 * Expected product outcomes vs bugs (DR-004). Throw DomainError with a key;
 * copy lives in copy/errors.ts. Never leak Prisma dumps to app/.
 */
export class DomainError extends Error {
  readonly key: string;
  /** Values for the placeholders of the copy (for example {name}); never shown by themselves. */
  readonly params: Readonly<Record<string, string>> | undefined;

  constructor(key: string, params?: Record<string, string>) {
    super(key);
    this.name = "DomainError";
    this.key = key;
    this.params = params;
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
