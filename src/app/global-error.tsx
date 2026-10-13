"use client";

import { PRIMARY_ACTION, StatusIcon, StatusPage, WarningIcon } from "@/components/shell/status-page";
import "./globals.css";

/**
 * Root layout failure (Next global-error): the server could not build the page frame. Must include
 * html and body (error.md). Client: no logger, no Prisma, no copy module. Same look as error.tsx,
 * with the app's tokens from globals.css (the theme class is not set here, so it shows the light
 * theme unless the device prefers dark). Never shows error.message or the digest. retry().
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="flex min-h-svh flex-col bg-background text-foreground antialiased">
        <StatusPage
          mark={
            <StatusIcon>
              <WarningIcon />
            </StatusIcon>
          }
          titleAr="تعذّر تحميل الصفحة"
          lineAr="حدث خطأ في الخادم. حاول مرة أخرى بعد لحظة."
          titleEn="The page could not load"
          lineEn="A server error happened. Please try again in a moment."
        >
          <button type="button" className={PRIMARY_ACTION} onClick={() => retry()}>
            حاول مرة أخرى · Try again
          </button>
        </StatusPage>
      </body>
    </html>
  );
}
