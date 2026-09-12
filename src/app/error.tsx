"use client";

import { Button } from "@/components/ui/button";

/**
 * Unexpected render failure (Next error.js). Client — no logger, no Prisma.
 * Do not show error.message (dev leak). retry() from local error.md (not reset).
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-6 py-8">
      <h1 className="font-heading text-2xl">Something went wrong. Try again.</h1>
      <p dir="rtl" className="text-muted-foreground">
        حدث خطأ. حاول مرة أخرى.
      </p>
      <p>
        <Button type="button" onClick={() => retry()}>
          Try again / حاول مرة أخرى
        </Button>
      </p>
      {error.digest ? (
        <p className="font-mono text-sm text-muted-foreground">
          <code>{error.digest}</code>
        </p>
      ) : null}
    </main>
  );
}
