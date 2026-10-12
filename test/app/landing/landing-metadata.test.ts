/** @jest-environment node */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { ui } from "@/lib/copy";
import { landingJsonLd, landingMetadata, landingUrl } from "@/app/(marketing)/landing/_components/landing-metadata";
import { generateMetadata as arabicMetadata } from "@/app/(marketing)/landing/page";
import { generateMetadata as englishMetadata } from "@/app/(marketing)/landing/en/page";

/** Landing slice 2: title, description, canonical, hreflang, Open Graph, Twitter, noindex. Written, not run when authored. */
const saved = { base: process.env.APP_BASE_DOMAIN, protocol: process.env.APP_PROTOCOL };
beforeAll(() => {
  process.env.APP_BASE_DOMAIN = "lebstads.test";
  process.env.APP_PROTOCOL = "https";
});
afterAll(() => {
  process.env.APP_BASE_DOMAIN = saved.base;
  process.env.APP_PROTOCOL = saved.protocol;
});

const hasOg = () => existsSync(join(process.cwd(), "public", "brand", "lebstads", "og.png"));

describe("landing metadata", () => {
  it("builds absolute URLs from APP_PROTOCOL and APP_BASE_DOMAIN", () => {
    expect(landingUrl("/")).toBe("https://lebstads.test/");
    expect(landingUrl("/en")).toBe("https://lebstads.test/en");
  });

  it.each([
    ["ar", "https://lebstads.test/", "ar_LB"],
    ["en", "https://lebstads.test/en", "en_US"],
  ] as const)("%s: title, description, canonical, alternates, Open Graph and Twitter", (locale, canonical, ogLocale) => {
    const metadata = landingMetadata(locale);
    expect(metadata.title).toBe(ui("landing.metaTitle", locale));
    expect(metadata.description).toBe(ui("landing.metaDescription", locale));
    expect(metadata.alternates).toEqual({
      canonical,
      languages: { ar: "https://lebstads.test/", en: "https://lebstads.test/en", "x-default": "https://lebstads.test/" },
    });
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      siteName: "LebStads",
      title: ui("landing.metaTitle", locale),
      description: ui("landing.metaDescription", locale),
      url: canonical,
      locale: ogLocale,
    });
    expect(metadata.twitter).toMatchObject({ card: hasOg() ? "summary_large_image" : "summary", title: ui("landing.metaTitle", locale) });
    // og.png only when the file exists.
    expect(Boolean((metadata.openGraph as { images?: unknown }).images)).toBe(hasOg());
  });

  it("is indexable (no robots meta; robots.ts and sitemap.ts list it) and links no manifest", () => {
    for (const locale of ["ar", "en"] as const) {
      expect(landingMetadata(locale).robots).toBeUndefined();
      expect(landingMetadata(locale).manifest).toBeNull();
    }
  });

  it("is what each page exports", () => {
    expect(arabicMetadata()).toEqual(landingMetadata("ar"));
    expect(englishMetadata()).toEqual(landingMetadata("en"));
  });

  it("writes JSON-LD that cannot close its script tag", () => {
    const json = landingJsonLd();
    expect(json).not.toContain("<");
    expect(JSON.parse(json)).toMatchObject({ "@type": "Organization", name: "LebStads", url: "https://lebstads.test/" });
  });
});
