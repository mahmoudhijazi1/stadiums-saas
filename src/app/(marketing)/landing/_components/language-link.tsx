import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";

/** The other language's page: on the Arabic page "English" to /en, on the English page "العربية" to /. */
export function LanguageLink({ locale, className }: { locale: UiLocale; className?: string }) {
  const toEnglish = locale === "ar";
  return (
    <a
      href={toEnglish ? "/en" : "/"}
      lang={toEnglish ? "en" : "ar"}
      className={`inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 ${className ?? ""}`}
    >
      {ui(toEnglish ? "landing.languageEn" : "landing.languageAr", locale)}
    </a>
  );
}
