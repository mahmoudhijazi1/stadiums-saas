import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { HeroPhone } from "@/app/(marketing)/landing/_components/hero-phone";
import { WhatsAppButton } from "@/app/(marketing)/landing/_components/whatsapp-button";

/** From 1024px two columns (the text, then the phone); below that stacked, the text first. */
export function Hero({ locale }: { locale: UiLocale }) {
  return (
    <section className="grid items-center gap-12 pt-10 pb-16 lg:grid-cols-2 lg:gap-16 lg:pt-16 lg:pb-24">
      <div className="flex min-w-0 flex-col items-start gap-6">
        <h1 className="text-3xl leading-tight font-semibold sm:text-4xl lg:text-5xl">{ui("landing.heroTitle", locale)}</h1>
        <p className="max-w-[60ch] text-lg text-muted-foreground">{ui("landing.heroSub", locale)}</p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <WhatsAppButton locale={locale} />
          <a href="#how" className="inline-flex min-h-12 items-center justify-center px-4 font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50">
            {ui("landing.heroSecondary", locale)}
          </a>
        </div>
      </div>
      <HeroPhone locale={locale} />
    </section>
  );
}
