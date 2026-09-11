"use client";

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
      <body>
        <main style={{ fontFamily: "system-ui", padding: "1.5rem", lineHeight: 1.6 }}>
          <h1>Something went wrong. Try again.</h1>
          <p dir="rtl">حدث خطأ. حاول مرة أخرى.</p>
          <p>
            <button type="button" onClick={() => retry()}>
              Try again / حاول مرة أخرى
            </button>
          </p>
          {error.digest ? <p><code>{error.digest}</code></p> : null}
        </main>
      </body>
    </html>
  );
}
