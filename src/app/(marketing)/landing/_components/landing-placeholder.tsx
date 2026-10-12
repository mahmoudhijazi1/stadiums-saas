import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";

/** Placeholder content of the landing page, in one language (the content slice replaces it). */
export function LandingPlaceholder({ locale }: { locale: UiLocale }) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 dir="ltr" className="text-3xl font-semibold">
        {ui("landing.name", locale)}
      </h1>
      <p className="text-muted-foreground">{ui("landing.placeholder", locale)}</p>
    </main>
  );
}
