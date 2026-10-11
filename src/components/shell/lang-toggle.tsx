"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { htmlDir, htmlLang, type UiLocale } from "@/lib/locale";
import { cn } from "cn";

/** The group's accessible name, in both languages whatever the page language is. */
const GROUP_LABEL = "Language / اللغة";

const OPTIONS: { locale: UiLocale; label: string; font: string }[] = [
  { locale: "ar", label: "عربي", font: "[font-family:var(--font-plex-arabic),var(--font-plex-arabic-latin),sans-serif]" },
  { locale: "en", label: "EN", font: "[font-family:var(--font-manrope),sans-serif]" },
];

/**
 * What choosing a language does, apart from the click: lang and dir change at once (no flash of
 * the other direction), the Server Action stores the cookie, then the same URL is refreshed. A
 * refresh, not a navigation, so the path and the query string stay exactly as they are.
 */
export async function switchLocale({
  next,
  current,
  onChangeLocale,
  root,
  refresh,
}: {
  next: UiLocale;
  current: UiLocale;
  onChangeLocale: (value: string) => Promise<unknown>;
  root: { lang: string; dir: string };
  refresh: () => void;
}): Promise<void> {
  if (next === current) return;
  root.lang = htmlLang(next);
  root.dir = htmlDir(next);
  await onChangeLocale(next);
  refresh();
}

/**
 * Two options, always both visible; the current one sits on a pill in the stadium's accent colour.
 * The control is LTR whatever the page language, so "عربي" and "EN" never swap sides and the pill
 * only slides (transform, 200ms, none under reduced motion). 36px tall to the eye, 44px to a finger.
 */
export function LangSegmented({
  current,
  onSelect,
  className,
}: {
  current: UiLocale;
  onSelect: (locale: UiLocale) => void;
  className?: string;
}) {
  const index = OPTIONS.findIndex((option) => option.locale === current);
  return (
    <div
      role="group"
      aria-label={GROUP_LABEL}
      dir="ltr"
      className={cn("relative inline-grid h-9 shrink-0 grid-cols-2 rounded-full border border-line bg-surface", className)}
    >
      <span
        aria-hidden
        data-slot="lang-pill"
        className={cn(
          "absolute inset-y-0.5 start-0.5 w-[calc(50%-0.125rem)] rounded-full bg-accent-brand",
          "transition-transform duration-200 ease-out motion-reduce:transition-none",
          index === 1 && "translate-x-full",
        )}
      />
      {OPTIONS.map((option) => {
        const pressed = option.locale === current;
        return (
          <button
            key={option.locale}
            type="button"
            lang={option.locale}
            aria-pressed={pressed}
            onClick={() => onSelect(option.locale)}
            className={cn(
              "relative z-10 -my-1 inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 type-label outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50",
              option.font,
              pressed ? "text-accent-ink" : "text-ink-muted",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** The language control. The page passes the real Server Action (setUiLocale). */
export function LangToggle({
  locale,
  className,
  onChangeLocale,
}: {
  locale: UiLocale;
  className?: string;
  onChangeLocale: (value: string) => Promise<unknown>;
}) {
  const router = useRouter();
  // Optimistic: the pill moves at once, the refresh brings the server's copy.
  const [current, setCurrent] = useState(locale);
  const [seen, setSeen] = useState(locale);
  if (seen !== locale) {
    setSeen(locale);
    setCurrent(locale);
  }

  return (
    <LangSegmented
      current={current}
      className={className}
      onSelect={(next) => {
        const from = current;
        setCurrent(next);
        void switchLocale({
          next,
          current: from,
          onChangeLocale,
          root: document.documentElement,
          refresh: () => router.refresh(),
        });
      }}
    />
  );
}
