import type { ReactNode } from "react";

/**
 * The frame of the app's status pages (not found, error, global error): full height, the soft accent
 * gradient of the public page, a pitch's centre circle and halfway line in thin lines behind, and one
 * centred column. The headline is Arabic first, the English line under it (the page may not know the
 * visitor's language: an error can come before anything else loaded). Tokens only. It imports nothing
 * that can fail: no copy module, no data, no server code.
 */
export function StatusPage({
  mark,
  titleAr,
  titleEn,
  lineAr,
  lineEn,
  children,
}: {
  /** A big code ("404") or an icon. */
  mark: ReactNode;
  titleAr: string;
  titleEn: string;
  lineAr: string;
  lineEn: string;
  /** The actions: one primary, then at most one quiet one. */
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-svh flex-1 items-center justify-center overflow-hidden bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--brand)_16%,var(--bg)),var(--bg)_70%)] px-5 py-12">
      <svg
        viewBox="0 0 400 400"
        aria-hidden="true"
        focusable="false"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="pointer-events-none absolute top-1/2 left-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 text-foreground opacity-[0.06] sm:size-[720px]"
      >
        <line x1="0" y1="200" x2="400" y2="200" />
        <circle cx="200" cy="200" r="90" />
        <circle cx="200" cy="200" r="4" fill="currentColor" />
      </svg>
      <div role="alert" className="relative flex w-full max-w-sm flex-col items-center gap-6 text-center">
        {mark}
        <div className="flex flex-col gap-2">
          <h1 lang="ar" dir="rtl" className="text-2xl font-semibold tracking-tight">
            {titleAr}
          </h1>
          <p lang="ar" dir="rtl" className="text-base text-muted-foreground">
            {lineAr}
          </p>
          <p lang="en" dir="ltr" className="text-sm text-muted-foreground">
            {titleEn}. {lineEn}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1">{children}</div>
      </div>
    </main>
  );
}

/** The round badge with an icon, for the error pages (the 404 shows its number instead). */
export function StatusIcon({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="flex size-16 items-center justify-center rounded-2xl border bg-card text-foreground shadow-sm">
      {children}
    </div>
  );
}

/** A plain warning sign (stroke icon), drawn inline so the error pages load nothing else. */
export function WarningIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** A compact pill: 44px high, the width of its label, a soft hover and press. */
export const PRIMARY_ACTION =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm outline-none transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.98] focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none";
export const QUIET_ACTION =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none";
