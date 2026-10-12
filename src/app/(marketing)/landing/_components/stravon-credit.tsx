import { existsSync } from "node:fs";
import { join } from "node:path";
import { LtrIsolate } from "@/components/ui/ltr-isolate";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";

/** Where the link goes: no tracking parameters. */
export const STRAVON_URL = "https://stravonsolutions.com";

/** Their logo is shown only when they supplied the file (svg or png); we never draw it. */
function stravonLogoPath(): string | null {
  for (const name of ["logo.svg", "logo.png"]) {
    if (existsSync(join(process.cwd(), "public", "brand", "stravon", name))) return `/brand/stravon/${name}`;
  }
  return null;
}

/**
 * The footer line "LebStads × Stravon Solutions". Brand names stay in Latin letters in both languages,
 * so the line is one LTR isolate and reads correctly inside the Arabic page. The name is the only link
 * (same tab, rel="noopener"). Nothing else about them appears on the page.
 */
export function StravonCredit({ locale }: { locale: UiLocale }) {
  const logo = stravonLogoPath();
  const name = ui("landing.stravonName", locale);
  return (
    <p className="text-sm text-muted-foreground">
      <LtrIsolate className="inline-flex items-center gap-1">
        {`${ui("landing.name", locale)} × `}
        {logo ? <img src={logo} alt={name} height={20} className="h-5 w-auto" /> : null}
        <a href={STRAVON_URL} rel="noopener" className="inline-flex min-h-11 items-center text-foreground underline underline-offset-4">
          {name}
        </a>
      </LtrIsolate>
    </p>
  );
}
