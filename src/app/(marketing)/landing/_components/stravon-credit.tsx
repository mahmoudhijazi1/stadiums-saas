import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";

/**
 * The footer line "LebStads × Stravon Solutions", plain text. Brand names stay in Latin letters in
 * both languages, so the line is one LTR isolate and reads correctly inside the Arabic page.
 */
export function StravonCredit({ locale }: { locale: UiLocale }) {
  return (
    <p className="text-sm text-muted-foreground">
      <LtrIsolate>{`${ui("landing.name", locale)} × ${ui("landing.stravonName", locale)}`}</LtrIsolate>
    </p>
  );
}
