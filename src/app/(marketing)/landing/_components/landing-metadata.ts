import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { bareUrl } from "@/lib/bare-url";
import { ui } from "@/lib/copy";
import { LEBSTADS_ICONS } from "@/lib/lebstads-brand";
import type { UiLocale } from "@/lib/locale";
import { landingWhatsAppHref, LEBSTADS_WHATSAPP } from "@/app/(marketing)/landing/_components/landing-contact";

/** The landing page's absolute URL on the bare domain: APP_PROTOCOL://APP_BASE_DOMAIN + path. */
export const landingUrl = bareUrl;

const PATH_OF = { ar: "/", en: "/en" } as const;
const OG_IMAGE_PATH = "/brand/lebstads/og.png";

/**
 * Per language: title, description, canonical, hreflang alternates (ar, en, x-default to the Arabic
 * page), Open Graph and Twitter (the og.png card only when the file exists), and no manifest link (the
 * bare host is not the installable owner app). Indexable: no robots meta (robots.ts and sitemap.ts list it).
 */
export function landingMetadata(locale: UiLocale): Metadata {
  const title = ui("landing.metaTitle", locale);
  const description = ui("landing.metaDescription", locale);
  const canonical = landingUrl(PATH_OF[locale]);
  const og = existsSync(join(process.cwd(), "public", OG_IMAGE_PATH)) ? landingUrl(OG_IMAGE_PATH) : null;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ar: landingUrl(PATH_OF.ar), en: landingUrl(PATH_OF.en), "x-default": landingUrl(PATH_OF.ar) },
    },
    openGraph: {
      type: "website",
      siteName: ui("landing.name", locale),
      title,
      description,
      url: canonical,
      locale: locale === "ar" ? "ar_LB" : "en_US",
      alternateLocale: locale === "ar" ? ["en_US"] : ["ar_LB"],
      ...(og ? { images: [{ url: og }] } : {}),
    },
    twitter: { card: og ? "summary_large_image" : "summary", title, description, ...(og ? { images: [og] } : {}) },
    manifest: null,
  };
}

/** One Organization with a WhatsApp contact point, as JSON safe to inline in a script tag. */
export function landingJsonLd(): string {
  const data = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LebStads",
    url: landingUrl("/"),
    logo: landingUrl(LEBSTADS_ICONS["512"]),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        telephone: `+${LEBSTADS_WHATSAPP}`,
        url: landingWhatsAppHref("en"),
        availableLanguage: ["Arabic", "English"],
      },
    ],
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
