"use client";

import { Button } from "@/components/ui/button";
import "./globals.css";

/**
 * Root layout failure (Next global-error). Must include html + body (error.md).
 * Client — no logger, no Prisma, no ui-copy. Do not show error.message. retry().
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-svh bg-[#f8f9fa] text-[#1a1d20]">
        <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-6 py-8">
          <h1 className="text-2xl font-semibold">حدث خطأ. حاول مرة أخرى.</h1>
          <p dir="ltr" className="text-[#495057]">
            Something went wrong. Try again.
          </p>
          <p>
            <Button type="button" onClick={() => retry()}>
              حاول مرة أخرى / Try again
            </Button>
          </p>
          {error.digest ? (
            <p className="font-mono text-sm text-[#495057]">
              <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
