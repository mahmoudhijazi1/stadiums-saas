import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { landingWhatsAppHref } from "@/app/(marketing)/landing/_components/landing-contact";
import { LanguageLink } from "@/app/(marketing)/landing/_components/language-link";
import { LogoMark } from "@/app/(marketing)/landing/_components/logo-mark";
import { PageColumn } from "@/app/(marketing)/landing/_components/page-column";

const NAV = [
  ["features", "landing.navFeatures"],
  ["how", "landing.navHow"],
  ["pricing", "landing.navPricing"],
  ["faq", "landing.navFaq"],
] as const;

/** A plain speech bubble (not a brand mark): the button's text and aria-label say WhatsApp. */
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="size-5 shrink-0" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.3L3 20.5l1.8-5.4A8.4 8.4 0 1 1 21 11.5Z" className="stroke-current" />
    </svg>
  );
}

/**
 * The sticky header: slim, a translucent surface with a hairline below. Start: the mark and the name.
 * Centre, from 1024px: the section links. End: the language switch and a small WhatsApp button (icon
 * only below 640px, with its aria-label; the text from 640px). It never wraps: every part is nowrap.
 */
export function LandingHeader({ locale }: { locale: UiLocale }) {
  const cta = ui("landing.whatsappCta", locale);
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <PageColumn className="flex h-14 flex-nowrap items-center gap-3">
        <a href={locale === "ar" ? "/" : "/en"} className="flex min-h-11 shrink-0 items-center gap-2">
          <LogoMark className="size-8 shrink-0" />
          <span dir="ltr" className="text-lg font-semibold whitespace-nowrap">
            {ui("landing.name", locale)}
          </span>
        </a>
        <nav aria-label={ui("landing.navLabel", locale)} className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex">
          {NAV.map(([id, key]) => (
            <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {ui(key, locale)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex shrink-0 items-center gap-1 lg:ms-0">
          <LanguageLink locale={locale} className="whitespace-nowrap" />
          <a
            href={landingWhatsAppHref(locale)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={cta}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border bg-card px-0 text-sm font-semibold whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:px-4"
          >
            <ChatIcon />
            <span className="hidden sm:inline">{cta}</span>
          </a>
        </div>
      </PageColumn>
    </header>
  );
}
