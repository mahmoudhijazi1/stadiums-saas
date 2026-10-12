import type { ReactNode } from "react";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { FEATURE_MOCKUPS } from "@/app/(marketing)/landing/_components/phone-mockups";
import { WhatsAppButton } from "@/app/(marketing)/landing/_components/whatsapp-button";

/** One section: a centred title and its body. 64px of space on phones, 96px from 1024px. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-16 flex-col gap-10 py-16 lg:py-24">
      <h2 id={`${id}-title`} className="text-center text-2xl font-semibold md:text-3xl">
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
      <ol className="grid gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-5">
            <span aria-hidden="true" dir="ltr" className="flex size-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
              {n}
            </span>
            <h3 className="font-semibold">{ui(`landing.step${n}Title`, locale)}</h3>
            <p className="max-w-[60ch] text-muted-foreground">{ui(`landing.step${n}Text`, locale)}</p>
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
          <li key={index} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
            {mockup}
            <h3 className="font-semibold">{ui(`landing.feature${index + 1}Title`, locale)}</h3>
            <p className="text-muted-foreground">{ui(`landing.feature${index + 1}Text`, locale)}</p>
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
    <section aria-labelledby="closing-title" className="mb-16 flex flex-col items-center gap-6 rounded-3xl bg-muted px-5 py-12 text-center lg:mb-24 lg:py-16">
      <h2 id="closing-title" className="text-2xl font-semibold md:text-3xl">
        {ui("landing.closingTitle", locale)}
      </h2>
      <WhatsAppButton locale={locale} />
    </section>
  );
}
