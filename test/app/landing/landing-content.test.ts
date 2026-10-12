/** @jest-environment node */
import { afterAll, describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COPY_AREAS, ui } from "@/lib/copy/ui";
import type { UiLocale } from "@/lib/locale";
import { LandingContent } from "@/app/(marketing)/landing/_components/landing-content";
import { landingWhatsAppHref, LEBSTADS_WHATSAPP } from "@/app/(marketing)/landing/_components/landing-contact";

/**
 * The redesigned landing page (header, hero, how a day runs, features, pricing, FAQ, closing band,
 * footer) in both languages. Written, not run when authored.
 */
const saved = { base: process.env.APP_BASE_DOMAIN, protocol: process.env.APP_PROTOCOL };
// Set at module level: the pages are rendered while the describe blocks are collected, before beforeAll runs.
process.env.APP_BASE_DOMAIN = "lebstads.test";
process.env.APP_PROTOCOL = "https";
afterAll(() => {
  process.env.APP_BASE_DOMAIN = saved.base;
  process.env.APP_PROTOCOL = saved.protocol;
});

const render = (locale: UiLocale) => renderToStaticMarkup(createElement(LandingContent, { locale }));
/** What React writes for a text: the characters it escapes in HTML. */
const escaped = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const headings = (markup: string, level: number) => [...markup.matchAll(new RegExp(`<h${level}[^>]*>(.*?)</h${level}>`, "g"))].map((match) => match[1]!);
const between = (markup: string, open: string, close: string) => markup.slice(markup.indexOf(open), markup.indexOf(close, markup.indexOf(open)) + close.length);
const visibleText = (markup: string) => markup.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");

const SECTION_TITLES = ["landing.stepsTitle", "landing.pageTitle", "landing.featuresTitle", "landing.priceTitle", "landing.faqTitle", "landing.closingTitle"];

describe.each<UiLocale>(["ar", "en"])("the landing page in %s", (locale) => {
  const markup = render(locale);
  const header = between(markup, "<header", "</header>");
  const footer = markup.slice(markup.indexOf("<footer"));

  it("does not name dollars and pounds in the hero or the steps, nor a list of sports", () => {
    const top = visibleText(markup.slice(0, markup.indexOf('id="features"')));
    expect(top).not.toMatch(/دولار|ليرة|dollar|pound/i);
    expect(top).not.toMatch(/football|padel|basketball|كرة القدم|البادل|السلة/i);
  });

  it("has the headline as its one h1, then the section headings in order: how, features, pricing, FAQ, closing", () => {
    expect(headings(markup, 1)).toEqual([escaped(ui("landing.heroTitle", locale))]);
    expect(headings(markup, 2)).toEqual(SECTION_TITLES.map((key) => escaped(ui(key, locale))));
  });

  it("has the sections with the ids the header links to", () => {
    for (const id of ["how", "features", "pricing", "faq"]) expect(markup).toContain(`id="${id}"`);
    const order = ["how", "features", "pricing", "faq"].map((id) => markup.indexOf(`id="${id}"`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("shows the hero sub-line and the secondary link to #how", () => {
    expect(markup).toContain(escaped(ui("landing.heroSub", locale)));
    expect(markup).toMatch(new RegExp(`<a href="#how"[^>]*>${escaped(ui("landing.heroSecondary", locale))}</a>`));
  });

  it("shows three numbered steps, six features, the pricing text and four questions", () => {
    expect(headings(markup, 3)).toEqual([
      ...[1, 2, 3].map((n) => escaped(ui(`landing.step${n}Title`, locale))),
      ...[1, 2, 3, 4, 5, 6].map((n) => escaped(ui(`landing.feature${n}Title`, locale))),
    ]);
    for (const n of [1, 2, 3]) expect(markup).toContain(escaped(ui(`landing.step${n}Text`, locale)));
    for (const n of [1, 2, 3, 4, 5, 6]) expect(markup).toContain(escaped(ui(`landing.feature${n}Text`, locale)));
    expect(markup.match(/<li [^>]*>\s*<span aria-hidden="true" dir="ltr"/g)).toHaveLength(3);
    expect(markup).toContain(escaped(ui("landing.priceText", locale)));
    for (const n of [1, 2, 3, 4]) {
      expect(markup).toContain(escaped(ui(`landing.faq${n}Question`, locale)));
      expect(markup).toContain(escaped(ui(`landing.faq${n}Answer`, locale)));
    }
  });

  it("has no Paper section: no such text, no such copy keys", () => {
    expect(visibleText(markup).toLowerCase()).not.toContain("paper");
    expect(visibleText(markup)).not.toContain("على الورق");
    const keys = Object.keys(COPY_AREAS.landing!.ar);
    expect(keys.filter((key) => /paper|appHeading|\.app\d|footerContact/.test(key))).toEqual([]);
  });

  it("has a header with the four section links, the language switch and the WhatsApp link", () => {
    for (const [id, key] of [["features", "landing.navFeatures"], ["how", "landing.navHow"], ["pricing", "landing.navPricing"], ["faq", "landing.navFaq"]] as const) {
      expect(header).toMatch(new RegExp(`<a href="#${id}"[^>]*>${escaped(ui(key, locale))}</a>`));
    }
    const links = [...header.matchAll(/<a href="#(\w+)"/g)].map((match) => match[1]);
    expect(links).toEqual(["features", "how", "pricing", "faq"]);
    if (locale === "ar") expect(header).toMatch(/<a href="\/en"[^>]*>English<\/a>/);
    else expect(header).toMatch(/<a href="\/"[^>]*>العربية<\/a>/);
    expect(header).toContain(`href="${landingWhatsAppHref(locale)}"`);
    expect(header).toContain(`aria-label="${escaped(ui("landing.whatsappCta", locale))}"`);
    expect(header).toContain(escaped(ui("landing.name", locale)));
  });

  it("keeps the header on one line, sticky and translucent, with the nav and the WhatsApp text responsive", () => {
    expect(header).toMatch(/sticky top-0/);
    expect(header).toContain("bg-background/80");
    expect(header).toContain("border-b");
    expect(header).toContain("flex-nowrap");
    expect(header).toMatch(/<nav[^>]*class="hidden [^"]*lg:flex/);
    expect(header).toMatch(/<span class="hidden sm:inline">/);
  });

  it("builds every WhatsApp link with the number and the prefilled text in the page's language", () => {
    const hrefs = [...markup.matchAll(/href="(https:\/\/wa\.me\/[^"]+)"/g)].map((match) => match[1]!);
    expect(hrefs).toHaveLength(3); // header, closing band, footer link
    for (const href of hrefs) {
      expect(href.startsWith(`https://wa.me/${LEBSTADS_WHATSAPP}?text=`)).toBe(true);
      expect(decodeURIComponent(href.split("?text=")[1]!)).toBe(ui("landing.whatsappMessage", locale));
      expect(href).toBe(landingWhatsAppHref(locale));
    }
    expect(LEBSTADS_WHATSAPP).toBe("96178862587");
  });

  it("has one primary WhatsApp button (the closing band), a small one in the header, none in the hero or the footer", () => {
    expect(markup.match(/hover:opacity-90/g)).toHaveLength(1); // the closing band
    expect(markup.match(/hover:bg-muted/g)).toHaveLength(1); // the header's small button
    expect(footer).not.toContain("hover:opacity-90");
    expect(footer).not.toContain("hover:bg-muted");
  });

  it("shows a drawn snapshot of a stadium's public page after the steps, hidden from assistive technology", () => {
    expect(markup.indexOf('id="how"')).toBeLessThan(markup.indexOf('id="page"'));
    expect(markup.indexOf('id="page"')).toBeLessThan(markup.indexOf('id="features"'));
    const start = markup.indexOf('<div aria-hidden="true" class="mx-auto w-full max-w-[340px]');
    expect(start).toBeGreaterThan(-1);
    const preview = markup.slice(start, markup.indexOf('id="features"'));
    expect(markup).toContain(escaped(ui("landing.pageText", locale)));
    for (const key of ["landing.previewStadium", "landing.previewAddress", "landing.previewNearest", "landing.previewTaken", "landing.previewRequest", "landing.previewDay1"]) {
      expect(preview).toContain(escaped(ui(key, locale)));
    }
    expect(preview).toContain("19:00");
    expect(preview).not.toContain("<img");
  });

  it("has a hero band with the accent gradient, the pitch lines and the eyebrow", () => {
    expect(markup).toContain("bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--brand)_20%,var(--bg)),var(--bg))]");
    expect(markup).toContain('<svg viewBox="0 0 400 520" aria-hidden="true"');
    expect(markup).toContain(escaped(ui("landing.heroEyebrow", locale)));
  });

  it("has a hero phone mock-up in HTML and CSS, hidden from assistive technology, with sample data", () => {
    const start = markup.indexOf('<div aria-hidden="true" class="w-full rounded-2xl border bg-card p-3');
    expect(start).toBeGreaterThan(-1);
    const phone = markup.slice(start, markup.indexOf('id="how"'));
    for (const key of ["landing.mockToday", "landing.mockNew", "landing.mockApprove", "landing.mockReject", "landing.mockConfirmed", "landing.mockToCollect"]) {
      expect(phone).toContain(escaped(ui(key, locale)));
    }
    expect(phone).toContain("bg-owed-subtle"); // the amber "To collect" row
    expect(markup).toContain("lg:grid-cols-2"); // two columns from 1024px, stacked below
  });

  it("ends with the footer, all centred, in order: mark and name, links, Stravon, copyright", () => {
    expect(footer).toContain("text-center");
    expect(footer).toContain("items-center");
    const at = (text: string) => footer.indexOf(text);
    const order = [at('<svg viewBox="0 0 64 64"'), at("https://www.instagram.com/lebstads/"), at("https://wa.me/"), at("LebStads × Stravon Solutions"), at("© 2026 LebStads")];
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(footer).not.toContain("stravonsolutions.com");
    expect(footer).toContain(`>${escaped(ui("landing.footerInstagram", locale))}</a>`);
    expect(footer).toContain(`>${escaped(ui("landing.footerWhatsapp", locale))}</a>`);
    expect(footer).toContain(escaped(ui("landing.copyright", locale)));
    if (locale === "ar") expect(footer).toMatch(/<a href="\/en"[^>]*>English<\/a>/);
    else expect(footer).toMatch(/<a href="\/"[^>]*>العربية<\/a>/);
    expect(markup.indexOf("</main>")).toBeLessThan(markup.indexOf("<footer"));
  });

  it("uses the responsive measures: a 1120px column with 20px padding, 48px then 96px sections, 1, 2 and 3 feature columns", () => {
    expect(markup).toContain("max-w-[1120px]");
    expect(markup).toContain("px-5");
    expect(markup).toMatch(/class="[^"]*\bpy-12\b[^"]*\blg:py-24\b/);
    expect(markup).toContain("sm:grid-cols-2 lg:grid-cols-3");
    expect(markup).toContain("max-w-[560px]"); // the pricing card
    expect(markup).toContain("max-w-[720px]"); // the FAQ column
    expect(markup).toContain("max-w-[60ch]");
    expect(markup).not.toMatch(/\bw-screen\b|\bmin-w-\[|overflow-x/);
  });

  it("shows no phone number, no price and no claim of what is not built", () => {
    const text = visibleText(markup);
    expect(text).not.toContain("78862587");
    expect(text).not.toContain("+961");
    expect(text.replace(ui("landing.mockAmount", locale), "")).not.toMatch(/\$\s?\d|\d\s?\$|USD\s?\d/);
    expect(text.toLowerCase()).not.toMatch(/offline|off-site|offsite/);
    expect(text).not.toMatch(/بدون إنترنت|بدون انترنت/);
    expect(text).not.toContain("!");
  });

  it("uses tokens only: no raw colour and no inline style", () => {
    expect(markup.replace(/href="#\w+"/g, "")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
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
  it("differ only in language", () => {
    expect(render("ar")).not.toBe(render("en"));
    expect(render("ar")).toContain(escaped(ui("landing.heroTitle", "ar")));
    expect(render("en")).toContain(escaped(ui("landing.heroTitle", "en")));
  });

  it("have the exact headline and button label of the brief", () => {
    expect(ui("landing.heroTitle", "ar")).toBe("حجوزات ملعبك ومدفوعاته، في مكان واحد");
    expect(ui("landing.heroTitle", "en")).toBe("Your stadium's bookings and payments, in one place");
    expect(ui("landing.whatsappCta", "ar")).toBe("واتساب");
    expect(ui("landing.whatsappCta", "en")).toBe("WhatsApp");
  });
});
