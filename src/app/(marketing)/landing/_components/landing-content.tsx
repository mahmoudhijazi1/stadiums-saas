import type { UiLocale } from "@/lib/locale";
import { Hero } from "@/app/(marketing)/landing/_components/landing-hero";
import { LandingFooter } from "@/app/(marketing)/landing/_components/landing-footer";
import { LandingHeader } from "@/app/(marketing)/landing/_components/landing-header";
import { landingJsonLd } from "@/app/(marketing)/landing/_components/landing-metadata";
import { ClosingBand, Faq, Features, HowItWorks, Pricing } from "@/app/(marketing)/landing/_components/landing-sections";
import { PageColumn } from "@/app/(marketing)/landing/_components/page-column";

/**
 * The landing page in one language: the sticky header, the hero, how a day runs, six features, pricing,
 * a short FAQ, a closing band and the footer, plus one inline JSON-LD Organization. Every text goes
 * through ui() with the page's constant locale; the app's tokens and fonts only.
 */
export function LandingContent({ locale }: { locale: UiLocale }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: landingJsonLd() }} />
      <LandingHeader locale={locale} />
      <PageColumn>
        <main>
          <Hero locale={locale} />
          <HowItWorks locale={locale} />
          <Features locale={locale} />
          <Pricing locale={locale} />
          <Faq locale={locale} />
          <ClosingBand locale={locale} />
        </main>
      </PageColumn>
      <LandingFooter locale={locale} />
    </>
  );
}
