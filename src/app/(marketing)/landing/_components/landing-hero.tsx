import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { HeroPhone } from "@/app/(marketing)/landing/_components/hero-phone";
import { PageColumn } from "@/app/(marketing)/landing/_components/page-column";
import { PitchLines } from "@/app/(marketing)/landing/_components/pitch-lines";
import { WhatsAppButton } from "@/app/(marketing)/landing/_components/whatsapp-button";

/**
 * The hero, full width: a soft gradient from a tint of the accent to the page background (as on a
 * stadium's public page) with half a pitch drawn in thin lines behind it, at the end side. From
 * 1024px two columns (the text, then the phone); stacked below, the text first. Compact on phones.
 */
export function Hero({ locale }: { locale: UiLocale }) {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--brand)_20%,var(--bg)),var(--bg))]">
      <PitchLines className="pointer-events-none absolute -end-28 -top-6 h-[420px] w-auto text-foreground opacity-[0.07] sm:-end-16 lg:-end-4 lg:h-[620px]" />
      <PageColumn className="relative grid items-center gap-6 pt-6 pb-8 sm:gap-10 sm:pt-8 sm:pb-12 lg:grid-cols-2 lg:gap-16 lg:pt-16 lg:pb-20">
        <div className="flex min-w-0 flex-col items-start gap-3 sm:gap-4 lg:gap-5">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            {ui("landing.heroEyebrow", locale)}
          </span>
          <h1 className="text-[1.6rem] leading-[1.2] font-semibold tracking-tight sm:text-4xl lg:text-5xl">{ui("landing.heroTitle", locale)}</h1>
          <p className="max-w-[60ch] text-[0.95rem] text-muted-foreground sm:text-lg">{ui("landing.heroSub", locale)}</p>
          <div className="mt-1 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <WhatsAppButton locale={locale} />
            <a href="#how" className="hidden min-h-11 sm:inline-flex items-center justify-center px-4 text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
              {ui("landing.heroSecondary", locale)}
            </a>
          </div>
        </div>
        <HeroPhone locale={locale} />
      </PageColumn>
    </section>
  );
}
