import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StadiumContact } from "@/app/(public)/_components/stadium-contact";
import { NoFreeTimes } from "@/app/(public)/_components/no-free-times";
import { ThemeIconButton } from "@/components/shell/theme-icon-button";

const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("StadiumContact: the action bar", () => {
  const render = (over: Partial<Parameters<typeof StadiumContact>[0]> = {}, locale: "ar" | "en" = "en") =>
    renderToStaticMarkup(
      createElement(StadiumContact, { mapLink: "https://maps.app.goo.gl/abc", phone: "03111222", whatsapp: "03111222", locale, ...over }),
    );

  it("is one bar of three equal parts with thin dividers, 48px, never wrapping, with a short label each", () => {
    const html = render();
    expect(html).toContain("flex-nowrap");
    expect(html).toContain("divide-x divide-line");
    expect(html.match(/h-12 min-w-0 flex-1/g)).toHaveLength(3);
    expect(html).toContain("whitespace-nowrap");
    expect(text(html)).toBe("MapCallWhatsApp");
    expect(html).toContain('aria-label="Open in Maps"');
    expect(text(render({}, "ar"))).toBe("الخريطةاتصالواتساب");
  });

  it("omits the parts that are not set and the rest share the width", () => {
    const html = render({ mapLink: "", whatsapp: "" });
    expect(html.match(/h-12 min-w-0 flex-1/g)).toHaveLength(1);
    expect(text(html)).toBe("Call");
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
  it("is a 36px disc in a 44px hit area, styled like the language control, with a label", () => {
    const html = renderToStaticMarkup(createElement(ThemeIconButton, { locale: "en" }));
    expect(html).toContain("size-11");
    expect(html).toContain("size-9");
    expect(html).toContain("border-line bg-surface");
  });

  it("is a labelled button with both icons in the markup, CSS shows the right one", () => {
    const html = renderToStaticMarkup(createElement(ThemeIconButton, { locale: "en" }));
    expect(html).toContain('aria-label="Theme"');
    expect(html).toContain("dark:hidden"); // moon in light
    expect(html).toContain("hidden size-4 dark:block"); // sun in dark
  });
});
