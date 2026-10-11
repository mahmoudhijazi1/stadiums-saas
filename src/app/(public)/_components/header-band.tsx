import { PitchLines } from "@/modules/stadium/ui/pitch-lines";
import { StadiumContact } from "@/app/(public)/_components/stadium-contact";
import { LangToggle } from "@/components/shell/lang-toggle";
import type { UiLocale } from "@/lib/locale";

/**
 * The top of the public page: a band with the pitch lines faintly drawn in the stadium's accent
 * behind the logo, name and address, the language control at the top end, and the contact pills
 * under them (only those that are set). The name is the one place the display face is used here.
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
    <header className="relative isolate flex flex-col gap-4 overflow-hidden rounded-xl border border-line bg-surface p-4">
      <PitchLines className="pointer-events-none absolute inset-0 -z-10 h-full w-full text-accent-brand opacity-15" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small generated PNG from our own route */}
          <img src={logoSrc} alt="" width={48} height={48} className="size-12 shrink-0 rounded-xl" />
          <div className="flex min-w-0 flex-col">
            <h1 className="min-w-0 font-display text-3xl leading-tight font-extrabold lg:text-4xl">{name}</h1>
            {address ? (
              <p className="type-secondary text-ink-muted" dir="auto">
                {address}
              </p>
            ) : null}
          </div>
        </div>
        <LangToggle locale={locale} onChangeLocale={onChangeLocale} />
      </div>
      <StadiumContact mapLink={mapLink} phone={phone} whatsapp={whatsapp} locale={locale} />
    </header>
  );
}
