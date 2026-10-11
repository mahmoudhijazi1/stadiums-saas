import { PitchLines } from "@/modules/stadium/ui/pitch-lines";
import { StadiumContact } from "@/app/(public)/_components/stadium-contact";
import { LangToggle } from "@/components/shell/lang-toggle";
import { ThemeIconButton } from "@/components/shell/theme-icon-button";
import { Container } from "@/components/ui/container";
import type { UiLocale } from "@/lib/locale";

/**
 * The top of the public page, full width with no frame: the faint pitch lines (accent colour) are
 * its background. Start side: logo and name, then the address on one line. End side: the language
 * control and the light/dark button. Under them one row of round contact buttons (only those set).
 * The name is the one place the display face is used.
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
    <header className="relative isolate overflow-hidden">
      <PitchLines className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-accent-brand opacity-20 dark:opacity-25" />
      <Container className="flex flex-col gap-3 pt-[max(1rem,env(safe-area-inset-top))] pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex min-w-0 items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- a small generated PNG from our own route */}
              <img src={logoSrc} alt="" width={40} height={40} className="size-10 shrink-0 rounded-xl" />
              <h1 className="min-w-0 truncate font-display text-2xl leading-tight font-extrabold lg:text-3xl">{name}</h1>
            </div>
            {address ? (
              <p className="type-secondary truncate" dir="auto" title={address}>
                {address}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <LangToggle locale={locale} onChangeLocale={onChangeLocale} />
            <ThemeIconButton locale={locale} />
          </div>
        </div>
        <StadiumContact mapLink={mapLink} phone={phone} whatsapp={whatsapp} locale={locale} />
      </Container>
    </header>
  );
}
