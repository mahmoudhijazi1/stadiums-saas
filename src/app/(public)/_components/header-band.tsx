import { MapPin } from "lucide-react";
import { PitchArc, headerGradient } from "@/modules/stadium/ui/pitch-arc";
import { StadiumContact } from "@/app/(public)/_components/stadium-contact";
import { LangToggle } from "@/components/shell/lang-toggle";
import { ThemeIconButton } from "@/components/shell/theme-icon-button";
import { Container } from "@/components/ui/container";
import type { UiLocale } from "@/lib/locale";

/**
 * The top of the public page, full width with no frame: a soft gradient from a tint of the
 * stadium's accent to the page background. Top end: the language control and the light/dark button
 * (same height and style, one baseline). Then one start-aligned column: logo, name (the page title,
 * the only display-face text) and the address with a map pin, one line. The decorative arc has a
 * box of its own at the end of that row, so it never sits behind text or a button. Last, the
 * action bar (Map, Call, WhatsApp; only those set).
 */
export function HeaderBand({
  name,
  address,
  logoSrc,
  mapLink,
  phone,
  whatsapp,
  locale,
  onChangeLocale,
}: {
  name: string;
  address: string;
  logoSrc: string;
  mapLink: string;
  phone: string;
  whatsapp: string;
  locale: UiLocale;
  onChangeLocale: (value: string) => Promise<unknown>;
}) {
  return (
    <header className="relative overflow-hidden" style={{ backgroundImage: headerGradient() }}>
      <Container className="flex flex-col gap-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-4">
        <div className="flex items-center justify-end gap-1">
          <LangToggle locale={locale} onChangeLocale={onChangeLocale} />
          <ThemeIconButton locale={locale} />
        </div>
        <div className="flex items-end gap-3">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small generated PNG from our own route */}
            <img src={logoSrc} alt="" width={56} height={56} className="size-14 shrink-0 rounded-2xl" />
            <h1 className="w-full min-w-0 truncate font-display text-3xl leading-tight font-extrabold lg:text-4xl">{name}</h1>
            {address ? (
              <p className="type-secondary flex w-full min-w-0 items-center gap-1.5">
                <MapPin aria-hidden className="size-3.5 shrink-0" />
                <span className="min-w-0 truncate" dir="auto" title={address}>
                  {address}
                </span>
              </p>
            ) : null}
          </div>
          <PitchArc className="-me-4 size-24 shrink-0 text-accent-brand opacity-30 md:-me-6 lg:-me-8" />
        </div>
        <StadiumContact mapLink={mapLink} phone={phone} whatsapp={whatsapp} locale={locale} />
      </Container>
    </header>
  );
}
