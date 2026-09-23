"use client";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Unexpected render failure (Next error.js). Client — no logger, no Prisma.
 * Do not show error.message (dev leak). retry() from local error.md (not reset).
 * Arabic-first; English second (SPEC-13). No ui-copy import on this path.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Container className="flex flex-col gap-4 py-8">
      <h1 className="font-heading text-3xl lg:text-4xl">حدث خطأ. حاول مرة أخرى.</h1>
      <p dir="ltr" className="text-muted-foreground">
        Something went wrong. Try again.
      </p>
      <p>
        <Button type="button" onClick={() => retry()}>
          حاول مرة أخرى / Try again
        </Button>
      </p>
      {error.digest ? (
        <p className="font-mono text-sm text-muted-foreground">
          <code>{error.digest}</code>
        </p>
      ) : null}
    </Container>
  );
}
