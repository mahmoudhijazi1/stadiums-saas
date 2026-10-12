import type { ReactNode } from "react";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { FEATURE_MOCKUPS } from "@/app/(marketing)/landing/_components/phone-mockups";
import { WhatsAppButton } from "@/app/(marketing)/landing/_components/whatsapp-button";

/** One section: a centred title and its body. 64px of space on phones, 96px from 1024px. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-16 flex-col gap-6 py-12 lg:gap-10 lg:py-24">
      <h2 id={`${id}-title`} className="text-center text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** How a day runs: three numbered steps, a real sequence. */
export function HowItWorks({ locale }: { locale: UiLocale }) {
  return (
    <Section id="how" title={ui("landing.stepsTitle", locale)}>
      <ol className="grid gap-3 lg:grid-cols-3 lg:gap-4">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex min-w-0 items-start gap-3 rounded-2xl border bg-card p-4 shadow-sm lg:flex-col lg:p-5">
            <span aria-hidden="true" dir="ltr" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground lg:size-10 lg:text-base">
              {n}
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <h3 className="font-semibold">{ui(`landing.step${n}Title`, locale)}</h3>
              <p className="max-w-[60ch] text-sm text-muted-foreground sm:text-base">{ui(`landing.step${n}Text`, locale)}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/** Six features: one column below 640px, two from 640px, three from 1024px. */
export function Features({ locale }: { locale: UiLocale }) {
  return (
    <Section id="features" title={ui("landing.featuresTitle", locale)}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_MOCKUPS.map((mockup, index) => (
          <li key={index} className="flex min-w-0 flex-col gap-2 rounded-2xl border bg-card p-4 shadow-sm">
            {mockup}
            <h3 className="font-semibold">{ui(`landing.feature${index + 1}Title`, locale)}</h3>
            <p className="text-sm text-muted-foreground sm:text-base">{ui(`landing.feature${index + 1}Text`, locale)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** One centred card, 560px at most. No number is shown. */
export function Pricing({ locale }: { locale: UiLocale }) {
  return (
    <Section id="pricing" title={ui("landing.priceTitle", locale)}>
      <div className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-6 rounded-2xl border bg-card p-6 text-center sm:p-8">
        <p className="max-w-[60ch] text-lg">{ui("landing.priceText", locale)}</p>
        <WhatsAppButton locale={locale} />
      </div>
    </Section>
  );
}

/** The four questions in one centred column, 720px at most. */
export function Faq({ locale }: { locale: UiLocale }) {
  return (
    <Section id="faq" title={ui("landing.faqTitle", locale)}>
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-3">
        {[1, 2, 3, 4].map((n) => (
          <details key={n} className="rounded-xl border bg-card px-4 py-1">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{ui(`landing.faq${n}Question`, locale)}</summary>
            <p className="max-w-[60ch] pb-3 text-muted-foreground">{ui(`landing.faq${n}Answer`, locale)}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

/** The closing band before the footer, centred. */
export function ClosingBand({ locale }: { locale: UiLocale }) {
  return (
    <section aria-labelledby="closing-title" className="relative mb-12 flex flex-col items-center gap-5 overflow-hidden rounded-3xl bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--brand)_20%,var(--bg)),var(--muted))] px-5 py-10 text-center lg:mb-24 lg:py-16">
      <h2 id="closing-title" className="text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl">
        {ui("landing.closingTitle", locale)}
      </h2>
      <WhatsAppButton locale={locale} />
    </section>
  );
}
