import { Container } from "@/components/ui/container";
import type { UiLocale } from "@/lib/locale";
import { landingJsonLd } from "@/app/(marketing)/landing/_components/landing-metadata";
import {
  Faq,
  Features,
  Hero,
  LandingFooter,
  LandingHeader,
  PaperVersusApp,
  Price,
  Steps,
} from "@/app/(marketing)/landing/_components/landing-sections";

/**
 * The landing page in one language: hero, paper versus the app, six features, three steps, price,
 * a short FAQ and the footer, plus one inline JSON-LD Organization. Every text goes through ui() with
 * the page's constant locale; the app's tokens and fonts only.
 */
export function LandingContent({ locale }: { locale: UiLocale }) {
  return (
    <Container>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: landingJsonLd() }} />
      <LandingHeader locale={locale} />
      <main>
        <Hero locale={locale} />
        <PaperVersusApp locale={locale} />
        <Features locale={locale} />
        <Steps locale={locale} />
        <Price locale={locale} />
        <Faq locale={locale} />
      </main>
      <LandingFooter locale={locale} />
    </Container>
  );
}
