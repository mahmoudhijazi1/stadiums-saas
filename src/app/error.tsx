"use client";

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
  );
}
