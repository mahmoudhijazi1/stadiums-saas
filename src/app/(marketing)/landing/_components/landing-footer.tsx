import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { LanguageLink } from "@/app/(marketing)/landing/_components/language-link";
import { LogoMark } from "@/app/(marketing)/landing/_components/logo-mark";
import { PageColumn } from "@/app/(marketing)/landing/_components/page-column";
import { StravonCredit } from "@/app/(marketing)/landing/_components/stravon-credit";
import { WhatsAppButton } from "@/app/(marketing)/landing/_components/whatsapp-button";

/**
 * Everything centred on every width, in this order: the mark and the name; "LebStads × Stravon
 * Solutions"; a row with WhatsApp and the language switch; the copyright. Muted text, a hairline above.
 */
export function LandingFooter({ locale }: { locale: UiLocale }) {
  return (
    <footer className="border-t py-10 text-center text-sm text-muted-foreground">
      <PageColumn className="flex flex-col items-center gap-5">
        <div className="flex items-center gap-2 text-foreground">
          <LogoMark className="size-8" />
          <span dir="ltr" className="text-lg font-semibold">
            {ui("landing.name", locale)}
          </span>
        </div>
        <StravonCredit locale={locale} />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <WhatsAppButton locale={locale} variant="secondary" />
          <LanguageLink locale={locale} />
        </div>
        <p>{ui("landing.copyright", locale)}</p>
      </PageColumn>
    </footer>
  );
}
