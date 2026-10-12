import type { ReactNode } from "react";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { FEATURE_MOCKUPS } from "@/app/(marketing)/landing/_components/phone-mockups";
import { LogoMark } from "@/app/(marketing)/landing/_components/logo-mark";
import { StravonCredit } from "@/app/(marketing)/landing/_components/stravon-credit";
import { WhatsAppButton } from "@/app/(marketing)/landing/_components/whatsapp-button";

/** One section: a title and its body, in the page's one centred column. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-6 py-10 md:py-14">
      <h2 id={id} className="text-2xl font-semibold md:text-3xl">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function LandingHeader({ locale }: { locale: UiLocale }) {
  return (
    <header className="flex items-center gap-3 py-4">
      <LogoMark className="size-10" />
      <span dir="ltr" className="text-xl font-semibold">
        {ui("landing.name", locale)}
      </span>
    </header>
  );
}

export function Hero({ locale }: { locale: UiLocale }) {
  return (
    <section className="flex flex-col items-start gap-5 py-10 md:py-16">
      <h1 className="text-3xl leading-tight font-semibold md:text-5xl">{ui("landing.heroTitle", locale)}</h1>
      <p className="max-w-2xl text-lg text-muted-foreground">{ui("landing.heroSub", locale)}</p>
      <WhatsAppButton locale={locale} />
    </section>
  );
}

export function PaperVersusApp({ locale }: { locale: UiLocale }) {
  const paper = ["landing.paper1", "landing.paper2", "landing.paper3"];
  const app = ["landing.app1", "landing.app2", "landing.app3"];
  return (
    <Section id="paper" title={ui("landing.paperTitle", locale)}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-xl bg-muted p-5">
          <h3 className="font-semibold text-muted-foreground">{ui("landing.paperHeading", locale)}</h3>
          <ul className="flex list-disc flex-col gap-2 ps-5">
            {paper.map((key) => (
              <li key={key}>{ui(key, locale)}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border-2 border-primary bg-card p-5">
          <h3 className="font-semibold">{ui("landing.appHeading", locale)}</h3>
          <ul className="flex list-disc flex-col gap-2 ps-5">
            {app.map((key) => (
              <li key={key}>{ui(key, locale)}</li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}

export function Features({ locale }: { locale: UiLocale }) {
  return (
    <Section id="features" title={ui("landing.featuresTitle", locale)}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURE_MOCKUPS.map((mockup, index) => (
          <li key={index} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            {mockup}
            <h3 className="font-semibold">{ui(`landing.feature${index + 1}Title`, locale)}</h3>
            <p className="text-muted-foreground">{ui(`landing.feature${index + 1}Text`, locale)}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Steps({ locale }: { locale: UiLocale }) {
  return (
    <Section id="steps" title={ui("landing.stepsTitle", locale)}>
      <ol className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((n) => (
          <li key={n} className="flex flex-col gap-2 rounded-xl border bg-card p-5">
            <span aria-hidden="true" dir="ltr" className="flex size-10 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground">
              {n}
            </span>
            <h3 className="font-semibold">{ui(`landing.step${n}Title`, locale)}</h3>
            <p className="text-muted-foreground">{ui(`landing.step${n}Text`, locale)}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function Price({ locale }: { locale: UiLocale }) {
  return (
    <Section id="price" title={ui("landing.priceTitle", locale)}>
      <p className="max-w-2xl text-lg">{ui("landing.priceText", locale)}</p>
      <div>
        <WhatsAppButton locale={locale} />
      </div>
    </Section>
  );
}

export function Faq({ locale }: { locale: UiLocale }) {
  return (
    <Section id="faq" title={ui("landing.faqTitle", locale)}>
      <div className="flex flex-col gap-3">
        {[1, 2, 3, 4].map((n) => (
          <details key={n} className="rounded-xl border bg-card px-4 py-1">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{ui(`landing.faq${n}Question`, locale)}</summary>
            <p className="pb-3 text-muted-foreground">{ui(`landing.faq${n}Answer`, locale)}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function LandingFooter({ locale }: { locale: UiLocale }) {
  const link = "inline-flex min-h-11 items-center px-2 underline-offset-4 hover:underline";
  return (
    <footer className="flex flex-col gap-5 border-t py-8">
      <div className="flex flex-col items-start gap-2">
        <span className="text-sm text-muted-foreground">{ui("landing.footerContact", locale)}</span>
        <WhatsAppButton locale={locale} variant="secondary" />
      </div>
      <nav aria-label={ui("landing.footerLanguage", locale)} className="flex items-center gap-2 text-sm">
        <a href="/" lang="ar" aria-current={locale === "ar" ? "page" : undefined} className={`${link} ${locale === "ar" ? "font-semibold" : ""}`}>
          {ui("landing.languageAr", locale)}
        </a>
        <span aria-hidden="true" className="text-muted-foreground">
          |
        </span>
        <a href="/en" lang="en" aria-current={locale === "en" ? "page" : undefined} className={`${link} ${locale === "en" ? "font-semibold" : ""}`}>
          {ui("landing.languageEn", locale)}
        </a>
      </nav>
      <StravonCredit locale={locale} />
    </footer>
  );
}
