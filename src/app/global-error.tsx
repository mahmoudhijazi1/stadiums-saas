"use client";

import { Button } from "@/components/ui/button";
import "./globals.css";

/**
 * Root layout failure (Next global-error). Must include html + body (error.md).
 * Client — no logger, no Prisma. Do not show error.message. retry(), not reset.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-svh bg-[#f8f9fa] text-[#1a1d20]">
        <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-6 py-8">
          <h1 className="text-2xl font-semibold">
            Something went wrong. Try again.
          </h1>
          <p dir="rtl" className="text-[#495057]">
            حدث خطأ. حاول مرة أخرى.
          </p>
          <p>
            <Button type="button" onClick={() => retry()}>
              Try again / حاول مرة أخرى
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
