import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "@jest/globals";
import { PitchDraftForm, type PitchFormDefaults } from "@/app/owner/(app)/more/settings/pitches/_components/form";
import { OtherCurrencyPrices } from "@/app/owner/(app)/more/settings/pitches/_components/other-currency-prices";
import { opensOtherCurrency } from "@/modules/venue/domain/pitch-form-model";
import { WEEKDAYS } from "@/modules/venue/domain/schedule-config";

/** DR-007: the pitch editor prices in the stadium currency and keeps the other currency in a collapsed, optional section. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();

const defaults = (over: Partial<PitchFormDefaults> = {}): PitchFormDefaults => ({
  name: "Main",
  hoursGroups: [{ days: [...WEEKDAYS], open: "16:00", close: "22:00" }],
  slotDurationMinutes: "60",
  defaultPlayerCount: "10",
  defaultPriceUsd: "30.00",
  defaultPriceLbp: "",
  priceRules: [],
  ...over,
});

function form(currency: "USD" | "LBP", props: { otherOpen?: boolean; defaults?: Partial<PitchFormDefaults> } = {}) {
  return renderToStaticMarkup(
    createElement(PitchDraftForm, {
      locale: "en",
      action: async () => {},
      pitchId: "p1",
      defaults: defaults(props.defaults),
      showPending: false,
      splitEnabled: true,
      hourCycle: "h23",
      dayStartHour: 6,
      currency,
      otherOpen: props.otherOpen,
    }),
  );
}

describe("the pitch editor of a stadium priced in dollars", () => {
  it("shows a collapsed section for the price in pounds", () => {
    const html = form("USD");
    expect(text(html)).toContain("Price in pounds (optional)");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="pitch-price-other"');
    expect(text(html)).not.toContain("Price in dollars (optional)");
  });

  it("opens it, with the pounds already stored, when the link names LBP", () => {
    const html = form("USD", { otherOpen: true, defaults: { defaultPriceLbp: "2000000" } });
    expect(html).toContain('id="pitch-price-other"');
    expect(html).toContain("2,000,000");
    expect(html).toContain('aria-expanded="true"');
  });
});

describe("the pitch editor of a stadium priced in pounds", () => {
  it("shows a collapsed section for the price in dollars", () => {
    const html = form("LBP", { defaults: { defaultPriceUsd: "0.00", defaultPriceLbp: "2000000" } });
    expect(text(html)).toContain("Price in dollars (optional)");
    expect(html).not.toContain('id="pitch-price-other"');
    expect(text(html)).not.toContain("Price in pounds (optional)");
  });
});

describe("the pounds field of the other-currency section", () => {
  const section = (defaultPrice: string) =>
    renderToStaticMarkup(
      createElement(OtherCurrencyPrices, {
        locale: "en",
        other: "LBP",
        defaultPrice,
        onDefaultPrice: () => {},
        cards: [],
        onCards: () => {},
        defaultOpen: true,
      }),
    );

  it("says why 12,345 is refused (whole pounds in steps of the unit) and accepts a multiple of it", () => {
    expect(text(section("12345"))).toContain("Use whole pounds in steps of");
    expect(text(section("2000000"))).not.toContain("Use whole pounds in steps of");
  });
});

describe("?currency=", () => {
  it("opens the other currency section only for the other currency; anything else is ignored", () => {
    expect(opensOtherCurrency("LBP", "USD")).toBe(true);
    expect(opensOtherCurrency("USD", "LBP")).toBe(true);
    expect(opensOtherCurrency("USD", "USD")).toBe(false);
    expect(opensOtherCurrency("LBP", "LBP")).toBe(false);
    for (const bad of [undefined, "", "lbp", "EUR", "LBP,USD"]) expect(opensOtherCurrency(bad, "USD")).toBe(false);
  });
});
