import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StadiumContact } from "@/app/(public)/_components/stadium-contact";
import { NoFreeTimes } from "@/app/(public)/_components/no-free-times";
import { ThemeIconButton } from "@/components/shell/theme-icon-button";

const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("StadiumContact: round icon buttons", () => {
  const render = (over: Partial<Parameters<typeof StadiumContact>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(StadiumContact, { mapLink: "https://maps.app.goo.gl/abc", phone: "03111222", whatsapp: "03111222", locale: "en", ...over }),
    );

  it("is one row that never wraps, three 44px round buttons with aria-labels and no visible text", () => {
    const html = render();
    expect(html).toContain("flex-nowrap");
    expect(html.match(/size-11/g)).toHaveLength(3);
    expect(html.match(/rounded-full/g)).toHaveLength(3);
    expect(html).toContain('aria-label="Open in Maps"');
    expect(html).toContain('aria-label="Call"');
    expect(html).toContain('aria-label="WhatsApp"');
    expect(text(html)).toBe("");
  });

  it("shows only the buttons that are set", () => {
    const html = render({ mapLink: "", whatsapp: "" });
    expect(html.match(/size-11/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Call"');
    expect(render({ mapLink: "", phone: "", whatsapp: "" })).toBe("");
  });
});

describe("NoFreeTimes", () => {
  it("is one line with the nearest free time as a link to that day", () => {
    const html = renderToStaticMarkup(
      createElement(NoFreeTimes, { locale: "en", nearest: { dateKey: "2026-10-16", dayLabel: "Fri", startLocal: "6:00 PM" } }),
    );
    expect(text(html)).toContain("No free times this day");
    expect(text(html)).toContain("Nearest: Fri 6:00 PM");
    expect(html).toContain('href="/?date=2026-10-16"');
  });

  it("is in Arabic, and has no link when nothing is free in the window", () => {
    const ar = renderToStaticMarkup(
      createElement(NoFreeTimes, { locale: "ar", nearest: { dateKey: "2026-10-16", dayLabel: "الجمعة", startLocal: "6:00 م" } }),
    );
    expect(text(ar)).toContain("لا أوقات متاحة هذا اليوم");
    expect(text(ar)).toContain("الأقرب: الجمعة");
    const none = renderToStaticMarkup(createElement(NoFreeTimes, { locale: "en", nearest: null }));
    expect(none).not.toContain("href");
  });
});

describe("ThemeIconButton", () => {
  it("is a labelled 44px button with both icons in the markup, CSS shows the right one", () => {
    const html = renderToStaticMarkup(createElement(ThemeIconButton, { locale: "en" }));
    expect(html).toContain('aria-label="Theme"');
    expect(html).toContain("size-11");
    expect(html).toContain("dark:hidden"); // moon in light
    expect(html).toContain("hidden size-5 dark:block"); // sun in dark
  });
});
