import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_COUNTRY } from "@/modules/people/domain/countries";
import { PHONE_COUNTRY_OPTIONS, PhoneField } from "@/modules/people/ui/phone-field";

/** Written, not run. The app's Select renders its list only when open, so the options are tested as data. */
function render(country: string = DEFAULT_COUNTRY, locale: "ar" | "en" = "en") {
  return renderToStaticMarkup(
    createElement(PhoneField, { locale, country, onCountryChange: () => {}, phoneId: "phone-x" }),
  );
}

describe("PhoneField", () => {
  const html = render();

  it("offers 13 countries as flag and +code, Lebanon first and the default", () => {
    expect(PHONE_COUNTRY_OPTIONS).toHaveLength(13);
    expect(PHONE_COUNTRY_OPTIONS[0]).toEqual({ code: "961", label: "\u{1F1F1}\u{1F1E7} +961" });
    expect(PHONE_COUNTRY_OPTIONS.map((option) => option.code)).toContain("963");
    expect(DEFAULT_COUNTRY).toBe("961");
  });

  it("shows 961 by default and submits it as country", () => {
    expect(html).toContain('<input type="hidden" name="country" value="961"');
    expect(html).toContain("\u{1F1F1}\u{1F1E7} +961");
    expect(render("963")).toContain('name="country" value="963"');
    expect(render("963")).toContain("+963");
  });

  it("is LTR in both languages and the trigger is labelled", () => {
    expect(html).toContain('dir="ltr"');
    expect(render("961", "ar")).toContain('dir="ltr"');
    expect(html).toContain('aria-label="Country code"');
    expect(render("961", "ar")).toContain('aria-label="رمز البلد"');
  });

  it("uses the app's select trigger and keeps the phone input attributes", () => {
    expect(html).toContain('data-slot="select-trigger"');
    expect(html).toContain('name="phone"');
    expect(html).toContain('inputMode="tel"');
    expect(html).toContain('autoComplete="tel"');
  });
});
