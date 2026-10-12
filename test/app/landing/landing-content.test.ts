/** @jest-environment node */
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import { LandingContent } from "@/app/(marketing)/landing/_components/landing-content";
import { landingWhatsAppHref, LEBSTADS_WHATSAPP } from "@/app/(marketing)/landing/_components/landing-contact";

/**
 * Landing slice 2: both pages render every section in their language, with the WhatsApp link, the
 * language switch and the JSON-LD. Written, not run when authored.
 */
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
/** What React writes for a text: the characters it escapes in HTML. */
const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const headings = (markup: string, level: number) => [...markup.matchAll(new RegExp(`<h${level}[^>]*>(.*?)</h${level}>`, "g"))].map((match) => match[1]!);

const SECTION_TITLES = ["landing.paperTitle", "landing.featuresTitle", "landing.stepsTitle", "landing.priceTitle", "landing.faqTitle"];

describe.each<UiLocale>(["ar", "en"])("the landing page in %s", (locale) => {
  const markup = render(locale);

  it("has the hero line as its one h1, then the five section headings in order", () => {
    expect(headings(markup, 1)).toEqual([escaped(ui("landing.heroTitle", locale))]);
    expect(headings(markup, 2)).toEqual(SECTION_TITLES.map((key) => escaped(ui(key, locale))));
  });

  it("shows the sub-line, the paper columns, six features, three steps and four questions", () => {
    expect(markup).toContain(escaped(ui("landing.heroSub", locale)));
    expect(headings(markup, 3)).toEqual([
      ...["landing.paperHeading", "landing.appHeading"].map((key) => escaped(ui(key, locale))),
      ...[1, 2, 3, 4, 5, 6].map((n) => escaped(ui(`landing.feature${n}Title`, locale))),
      ...[1, 2, 3].map((n) => escaped(ui(`landing.step${n}Title`, locale))),
    ]);
    for (const n of [1, 2, 3]) {
      expect(markup).toContain(escaped(ui(`landing.paper${n}`, locale)));
      expect(markup).toContain(escaped(ui(`landing.app${n}`, locale)));
    }
    for (const n of [1, 2, 3, 4]) {
      expect(markup).toContain(escaped(ui(`landing.faq${n}Question`, locale)));
      expect(markup).toContain(escaped(ui(`landing.faq${n}Answer`, locale)));
    }
    expect(markup).toContain(escaped(ui("landing.priceText", locale)));
  });

  it("builds every WhatsApp link with the number and the prefilled text in the page's language", () => {
    const hrefs = [...markup.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map((match) => match[1]!);
    expect(hrefs).toHaveLength(3); // hero, price, footer
    for (const href of hrefs) {
      expect(href.startsWith(`https://wa.me/${LEBSTADS_WHATSAPP}?text=`)).toBe(true);
      expect(decodeURIComponent(href.split("?text=")[1]!)).toBe(ui("landing.whatsappMessage", locale));
      expect(href).toBe(landingWhatsAppHref(locale));
    }
    expect(LEBSTADS_WHATSAPP).toBe("96178862587");
  });

  it("has two primary buttons (hero, price) and a secondary one in the footer", () => {
    expect(markup.match(/hover:opacity-90/g)).toHaveLength(2);
    expect(markup.match(/hover:bg-muted/g)).toHaveLength(1);
  });

  it("links the language switch to / and /en and marks the current one", () => {
    expect(markup).toMatch(/<a href="\/"[^>]*>/);
    expect(markup).toMatch(/<a href="\/en"[^>]*>/);
    const current = [...markup.matchAll(/<a href="([^"]+)"[^>]*aria-current="page"/g)].map((match) => match[1]);
    expect(current).toEqual([locale === "ar" ? "/" : "/en"]);
  });

  it("shows no phone number, no price and no claim of what is not built", () => {
    const text = markup.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
    expect(text).not.toContain("78862587");
    expect(text).not.toContain("+961");
    expect(text).not.toMatch(/\$\s?\d|\d\s?\$|USD\s?\d/);
    expect(text.toLowerCase()).not.toMatch(/offline|off-site|offsite/);
    expect(text).not.toMatch(/بدون إنترنت|بدون انترنت/);
  });

  it("uses tokens only: no raw colour and no inline style", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(markup).not.toContain("style=");
  });

  it("carries one JSON-LD Organization with the WhatsApp contact point", () => {
    const blocks = [...markup.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => match[1]!);
    expect(blocks).toHaveLength(1);
    const data = JSON.parse(blocks[0]!) as { "@type": string; name: string; url: string; logo: string; contactPoint: Array<{ telephone: string; url: string }> };
    expect(data).toMatchObject({ "@type": "Organization", name: "LebStads", url: "https://lebstads.test/", logo: "https://lebstads.test/brand/lebstads/icon-512.png" });
    expect(data.contactPoint[0]).toMatchObject({ telephone: "+96178862587" });
    expect(data.contactPoint[0]!.url.startsWith("https://wa.me/96178862587?text=")).toBe(true);
  });
});

describe("the two languages", () => {
  it("have the same copy keys, and the page differs only in language", () => {
    expect(render("ar")).not.toBe(render("en"));
    expect(render("ar")).toContain(escaped(ui("landing.heroTitle", "ar")));
    expect(render("en")).toContain(escaped(ui("landing.heroTitle", "en")));
  });
});
