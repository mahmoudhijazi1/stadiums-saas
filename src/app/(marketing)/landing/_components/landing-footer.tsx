import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { LEBSTADS_INSTAGRAM, landingWhatsAppHref } from "@/app/(marketing)/landing/_components/landing-contact";
import { LanguageLink } from "@/app/(marketing)/landing/_components/language-link";
import { LogoMark } from "@/app/(marketing)/landing/_components/logo-mark";
import { PageColumn } from "@/app/(marketing)/landing/_components/page-column";
import { StravonCredit } from "@/app/(marketing)/landing/_components/stravon-credit";

const LINK = "inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * Everything centred on every width: the mark and the name; a row of small links (Instagram,
 * WhatsApp, the other language); "LebStads × Stravon Solutions"; the copyright. Muted, a hairline above.
 */
export function LandingFooter({ locale }: { locale: UiLocale }) {
  return (
    <footer className="border-t py-10 text-center text-sm text-muted-foreground">
      <PageColumn className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-foreground">
          <LogoMark className="size-8" />
          <span dir="ltr" className="text-lg font-semibold">
            {ui("landing.name", locale)}
          </span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-1">
          <a href={LEBSTADS_INSTAGRAM} target="_blank" rel="noopener noreferrer" className={LINK}>
            {ui("landing.footerInstagram", locale)}
          </a>
          <a href={landingWhatsAppHref(locale)} target="_blank" rel="noopener noreferrer" className={LINK}>
            {ui("landing.footerWhatsapp", locale)}
          </a>
          <LanguageLink locale={locale} />
        </nav>
        <StravonCredit locale={locale} />
        <p>{ui("landing.copyright", locale)}</p>
      </PageColumn>
    </footer>
  );
}
