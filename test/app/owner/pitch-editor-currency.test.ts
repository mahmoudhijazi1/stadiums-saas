/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PitchDraftForm, type PitchFormDefaults } from "@/app/owner/(app)/more/settings/pitches/_components/form";
import { ui } from "@/lib/copy";
import { formatPrice } from "@/lib/format/money";
import type { GamePriceCurrency } from "@/lib/tenant-settings";
import { buildFreeStrip } from "@/modules/booking/domain/free-strip";
import { TimeRows } from "@/modules/booking/ui/time-rows";
import type { SlotPickerPitch } from "@/modules/booking/ui/slot-picker";
import { WEEKDAYS } from "@/modules/venue/domain/schedule-config";

/** DR-007 slice 4: the pitch editor and the price displays follow the stadium's currency. */
const DEFAULTS: PitchFormDefaults = {
  name: "Pitch A",
  hoursGroups: [{ days: [...WEEKDAYS], open: "18:00", close: "22:00" }],
  slotDurationMinutes: "60",
  defaultPlayerCount: "10",
  defaultPriceUsd: "30.00",
  defaultPriceLbp: "2000000",
  priceRules: [{ days: ["fri"], priceUsd: "40.00", priceLbp: "2500000" }],
};

function renderForm(currency: GamePriceCurrency, defaults: Partial<PitchFormDefaults> = {}) {
  return renderToStaticMarkup(
    createElement(PitchDraftForm, {
      locale: "en",
      action: async () => {},
      pitchId: "p1",
      defaults: { ...DEFAULTS, ...defaults },
      showPending: false,
      splitEnabled: false,
      hourCycle: "h23",
      dayStartHour: 6,
      currency,
    }),
  );
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ");

describe("pitch editor currency", () => {
  it("an LBP stadium types pounds: grouped digits and the LBP unit, no dollar field", () => {
    const html = renderForm("LBP");
    expect(html).toContain('value="2,000,000"');
    expect(html).toContain('value="2,500,000"');
    expect(text(html)).toContain("LBP");
    expect(html).not.toMatch(/>\$<\/span>/); // the MoneyInput "$" prefix
    // The USD prices still post unchanged, so switching back loses nothing.
    expect(html).toContain('name="defaultPriceUsd" value="30.00"');
    expect(html).toContain('name="defaultPriceLbp" value="2000000"');
  });

  it("an LBP price that is not in steps of 5,000 says so", () => {
    expect(text(renderForm("LBP", { defaultPriceLbp: "12345" }))).toContain(ui("owner.pitchLbpUnit", "en"));
    expect(text(renderForm("LBP"))).not.toContain(ui("owner.pitchLbpUnit", "en"));
  });

  it("a USD stadium sees the dollar fields exactly as before, and no pound field", () => {
    const html = renderForm("USD");
    expect(html).toMatch(/>\$<\/span>/);
    expect(html).toContain('value="30.00"');
    expect(html).not.toContain('value="2,000,000"');
    expect(text(html)).not.toContain(ui("owner.pitchLbpUnit", "en"));
    // The pounds ride along hidden.
    expect(html).toContain('name="defaultPriceLbp" value="2000000"');
  });

  it("the preview shows the games in the stadium's currency", () => {
    // No day rule, so the preview's day (whichever weekday today is) has the default price.
    expect(text(renderForm("LBP", { priceRules: [] }))).toMatch(/2,000,000 LBP each/);
    expect(text(renderForm("USD", { priceRules: [] }))).toMatch(/\$30 each/);
  });
});

describe("price displays use the stadium's currency", () => {
  const lbp = (amount: string) => ({ currency: "LBP" as const, amount });
  const slot = (hour: number, price: ReturnType<typeof lbp> | null) => ({
    startIso: `2026-10-16T${hour}:00:00.000Z`,
    endIso: `2026-10-16T${hour + 1}:00:00.000Z`,
    startLocal: `${hour + 3}:00`,
    endLocal: `${hour + 4}:00`,
    price,
    available: true,
  });

  it("formats each currency with the shared formatters", () => {
    expect(formatPrice({ currency: "LBP", amount: "2000000" }, "en")).toBe("2,000,000 LBP");
    expect(formatPrice({ currency: "LBP", amount: "2000000" }, "ar")).toBe("2,000,000 ل.ل");
    expect(formatPrice({ currency: "USD", amount: "30.00" }, "en")).toBe("$30");
  });

  it("the public and Book time rows head the list with the pound price, and show a different one per row", () => {
    const pitches: SlotPickerPitch[] = [
      { id: "a", name: "A", emptyKind: null, slots: [slot(15, lbp("2000000")), slot(16, lbp("2000000")), slot(17, lbp("2500000"))] },
    ];
    const html = text(renderToStaticMarkup(createElement(TimeRows, { pitches, locale: "en", onPick: () => {} })));
    expect(html).toContain("2,000,000 LBP");
    expect(html).toContain("2,500,000 LBP");
    expect(html).not.toContain("$");
  });

  it("a time with no price in the stadium's currency shows no price, never a dollar one", () => {
    const pitches: SlotPickerPitch[] = [{ id: "a", name: "A", emptyKind: null, slots: [slot(15, null), slot(16, null)] }];
    const html = text(renderToStaticMarkup(createElement(TimeRows, { pitches, locale: "en", onPick: () => {} })));
    expect(html).not.toContain("$");
    expect(html).not.toContain("LBP");
  });

  it("Today's free strip keeps pound prices and hides the pitch default", () => {
    const base = { pitchId: "a", pitchName: "A", defaultPrice: lbp("2000000") };
    const [pitch] = buildFreeStrip(
      [
        { ...base, ...slot(15, lbp("2000000")) },
        { ...base, ...slot(16, lbp("2500000")) },
      ],
      [],
      new Map(),
      new Date("2026-10-16T00:00:00Z"),
    );
    expect(pitch!.chips.map((chip) => [chip.price?.amount ?? null, chip.fullPrice?.amount])).toEqual([
      [null, "2000000"],
      ["2500000", "2500000"],
    ]);
  });
});
