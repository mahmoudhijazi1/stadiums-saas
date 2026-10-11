import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COUNTRIES, DEFAULT_COUNTRY } from "@/modules/people/domain/countries";
import { PhoneField } from "@/modules/people/ui/phone-field";

/** Written, not run. */
function render(country: string = DEFAULT_COUNTRY, locale: "ar" | "en" = "en") {
  return renderToStaticMarkup(
    createElement(PhoneField, { locale, country, onCountryChange: () => {}, phoneId: "phone-x" }),
  );
}

describe("PhoneField", () => {
  const html = render();

  it("renders one option per country, flag and +code, with 961 selected by default", () => {
    expect(html.match(/<option/g)).toHaveLength(13);
    expect(COUNTRIES).toHaveLength(13);
    expect(html).toContain("\u{1F1F1}\u{1F1E7} +961");
    expect(html).toMatch(/<option value="961" selected/);
    expect(html.match(/selected/g)).toHaveLength(1);
  });

  it("selects the chosen country", () => {
    expect(render("963")).toMatch(/<option value="963" selected/);
  });

  it("submits country and phone, is LTR in both languages and the select is labelled", () => {
    expect(html).toContain('name="country"');
    expect(html).toContain('name="phone"');
    expect(html).toContain('dir="ltr"');
    expect(render("961", "ar")).toContain('dir="ltr"');
    expect(html).toContain('aria-label="Country code"');
    expect(render("961", "ar")).toContain('aria-label="رمز البلد"');
  });

  it("keeps the phone input attributes and uses the 16px field role on the select", () => {
    expect(html).toContain('inputMode="tel"');
    expect(html).toContain('autoComplete="tel"');
    expect(html).toMatch(/<select[^>]*type-field/);
  });
});
