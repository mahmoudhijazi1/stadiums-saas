/** @jest-environment node */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { UiLocale } from "@/lib/locale";
import { LandingContent } from "@/app/(marketing)/landing/_components/landing-content";
import { landingJsonLd, landingMetadata } from "@/app/(marketing)/landing/_components/landing-metadata";

/** The Stravon Solutions footer line (landing). Written, not run when authored. */
const saved = { base: process.env.APP_BASE_DOMAIN, protocol: process.env.APP_PROTOCOL };
beforeAll(() => {
  process.env.APP_BASE_DOMAIN = "lebstads.test";
  process.env.APP_PROTOCOL = "https";
});
afterAll(() => {
  process.env.APP_BASE_DOMAIN = saved.base;
  process.env.APP_PROTOCOL = saved.protocol;
});

const render = (locale: UiLocale) => renderToStaticMarkup(createElement(LandingContent, { locale }));
const logoFile = () => ["logo.svg", "logo.png"].find((name) => existsSync(join(process.cwd(), "public", "brand", "stravon", name)));

describe.each<UiLocale>(["ar", "en"])("the landing footer in %s", (locale) => {
  const markup = render(locale);
  const footer = markup.slice(markup.indexOf("<footer"));

  it("has the line LebStads × Stravon Solutions in one LTR isolate, with the exact link", () => {
    expect(footer).toMatch(/<bdi dir="ltr"[^>]*>LebStads × (?:<img [^>]*>)?<a href="https:\/\/stravonsolutions\.com" rel="noopener"[^>]*>Stravon Solutions<\/a><\/bdi>/);
  });

  it("opens in the same tab, with no tracking parameters", () => {
    const link = footer.match(/<a href="https:\/\/stravonsolutions\.com[^"]*"[^>]*>/)![0];
    expect(link).toContain('href="https://stravonsolutions.com"');
    expect(link).not.toContain("target=");
    expect(link).not.toMatch(/[?&]utm|\?/);
    expect(link).not.toContain("noreferrer");
  });

  it("shows their logo only when public/brand/stravon has one, with the alt text", () => {
    const logo = logoFile();
    if (logo) expect(footer).toContain(`<img src="/brand/stravon/${logo}" alt="Stravon Solutions"`);
    else expect(footer).not.toContain("<img");
  });

  it("mentions Stravon nowhere else in the page text, and uses no powered-by, partnership or support wording", () => {
    const text = markup.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
    expect(text.match(/stravon/gi)).toHaveLength(1);
    expect(text.toLowerCase()).not.toMatch(/powered by|by stravon|stravon by|partner|sponsor|supported by|support from/);
    expect(text).not.toMatch(/بدعم من|بواسطة|شراكة|برعاية/);
    // The only places the name appears in the markup: the link text and its href.
    expect(markup.match(/stravon/gi)).toHaveLength(2 + (logoFile() ? 2 : 0));
  });

  it("has no Stravon entry in the JSON-LD or in the page metadata", () => {
    const blocks = [...markup.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => match[1]!);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).not.toMatch(/stravon/i);
    expect(landingJsonLd()).not.toMatch(/stravon/i);
    expect(JSON.stringify(landingMetadata(locale))).not.toMatch(/stravon/i);
  });
});
