/** @jest-environment node */
import { afterAll, describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { UiLocale } from "@/lib/locale";
import { LandingContent } from "@/app/(marketing)/landing/_components/landing-content";
import { landingJsonLd, landingMetadata } from "@/app/(marketing)/landing/_components/landing-metadata";

/** The footer line "LebStads × Stravon Solutions": plain text, no link. */
const saved = { base: process.env.APP_BASE_DOMAIN, protocol: process.env.APP_PROTOCOL };
// Set at module level: the pages are rendered while the describe blocks are collected.
process.env.APP_BASE_DOMAIN = "lebstads.test";
process.env.APP_PROTOCOL = "https";
afterAll(() => {
  process.env.APP_BASE_DOMAIN = saved.base;
  process.env.APP_PROTOCOL = saved.protocol;
});

const render = (locale: UiLocale) => renderToStaticMarkup(createElement(LandingContent, { locale }));

describe.each<UiLocale>(["ar", "en"])("the landing footer in %s", (locale) => {
  const markup = render(locale);
  const footer = markup.slice(markup.indexOf("<footer"));

  it("has the line LebStads × Stravon Solutions in one LTR isolate, as plain text", () => {
    expect(footer).toMatch(/<bdi dir="ltr"[^>]*>LebStads × Stravon Solutions<\/bdi>/);
    expect(markup).not.toContain("stravonsolutions.com");
  });

  it("mentions Stravon nowhere else, and has no Stravon entry in the JSON-LD or the metadata", () => {
    expect(markup.match(/stravon/gi)).toHaveLength(1);
    expect(landingJsonLd()).not.toMatch(/stravon/i);
    expect(JSON.stringify(landingMetadata(locale))).not.toMatch(/stravon/i);
  });
});
