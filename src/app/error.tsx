"use client";

import { BackButton } from "@/components/shell/back-button";
import { PRIMARY_ACTION, QUIET_ACTION, StatusIcon, StatusPage, WarningIcon } from "@/components/shell/status-page";

/**
 * Unexpected render failure (Next error.js). Client: no logger, no Prisma, no copy module (this page
 * must not depend on anything that may itself have failed). Never shows error.message or the digest:
 * the digest is in the server log for whoever needs it. retry() per local error.md (not reset).
 */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <StatusPage
      mark={
        <StatusIcon>
          <WarningIcon />
        </StatusIcon>
      }
      titleAr="حدث خطأ غير متوقع"
      lineAr="حاول مرة أخرى بعد لحظة."
      titleEn="Something went wrong"
      lineEn="Please try again in a moment."
    >
      <button type="button" className={PRIMARY_ACTION} onClick={() => retry()}>
        حاول مرة أخرى · Try again
      </button>
      <BackButton label="رجوع · Go back" className={QUIET_ACTION} />
    </StatusPage>
  );
}
