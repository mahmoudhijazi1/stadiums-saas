"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

/**
 * Unexpected render failure (Next error.js). Client: no logger, no Prisma.
 * Never show error.message (dev leak). retry() per local error.md (not reset).
 * Arabic-first, English second (SPEC-13). No ui-copy import on this path: this
 * page must not depend on anything that may itself have failed.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copyDigest() {
    if (!error.digest) return;
    try {
      await navigator.clipboard.writeText(error.digest);
      setCopied(true);
    } catch {
      // Clipboard can be blocked; the code stays visible so it can be read out.
    }
  }

  function goBack() {
    if (window.history.length > 1) window.history.back();
    else window.location.reload();
  }

  return (
    <Container className="flex min-h-[70dvh] items-center justify-center py-8">
      <div role="alert" className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
        <div
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <div className="flex flex-col gap-2">
          <h1 lang="ar" dir="rtl" className="text-xl font-semibold">
            حدث خطأ أثناء عرض الصفحة
          </h1>
          <p lang="ar" dir="rtl" className="text-base text-muted-foreground">
            حاول مرة أخرى. إذا تكرر الخطأ، أرسل لنا الرمز أدناه.
          </p>
          <p lang="en" dir="ltr" className="text-sm text-muted-foreground">
            Something went wrong while showing this page. Try again, and if it keeps
            happening, send us the code below.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2">
          <Button type="button" className="h-12 w-full" onClick={() => retry()}>
            حاول مرة أخرى · Try again
          </Button>
          <Button type="button" variant="ghost" className="h-12 w-full" onClick={goBack}>
            رجوع · Go back
          </Button>
        </div>

        {error.digest ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>رمز الخطأ · Error code</span>
            <code dir="ltr" className="select-all rounded-md bg-muted px-2 py-1 font-mono">
              {error.digest}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11 px-2 text-xs"
              onClick={copyDigest}
              aria-live="polite"
            >
              {copied ? "تم النسخ · Copied" : "نسخ · Copy"}
            </Button>
          </div>
        ) : null}
      </div>
    </Container>
  );
}