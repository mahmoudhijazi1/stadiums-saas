import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TimeRows } from "@/modules/booking/ui/time-rows";
import { NextFreeCard } from "@/modules/booking/ui/next-free-card";
import type { SlotPickerPitch } from "@/modules/booking/ui/slot-picker";

// Beirut is UTC+3 in October 2026.
const slot = (utcHour: number, priceUsd = "20.00", available = true) => ({
  startIso: `2026-10-16T${String(utcHour).padStart(2, "0")}:00:00.000Z`,
  endIso: `2026-10-16T${String(utcHour + 1).padStart(2, "0")}:00:00.000Z`,
  startLocal: `${utcHour + 3}:00`,
  endLocal: `${utcHour + 4}:00`,
  priceUsd,
  available,
});
const pitch = (id: string, slots: SlotPickerPitch["slots"]): SlotPickerPitch => ({ id, name: `Pitch ${id}`, slots, emptyKind: null });
const text = (html: string) => html.replace(/<[^>]+>/g, "");

function render(pitches: SlotPickerPitch[], locale: "ar" | "en" = "en") {
  return renderToStaticMarkup(
    createElement(TimeRows, { pitches, locale, timeZone: "Asia/Beirut", dayStartHour: 6, onPick: () => {} }),
  );
}

describe("TimeRows", () => {
  // 07:00 morning, 13:00 afternoon, 18:00 evening, 19:00 evening (taken)
  const html = render([pitch("a", [slot(4), slot(10), slot(15), slot(16, "20.00", false)])]);

  it("groups by period with evening first and hides empty periods", () => {
    const order = ["Evening", "Afternoon", "Morning"].map((name) => html.indexOf(name));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(render([pitch("a", [slot(15)])])).not.toContain("Morning");
    expect(html).toContain("lucide-moon");
    expect(html).toContain("lucide-sun");
    expect(html).toContain("lucide-sunrise");
  });

  it("shows the full range and the price, a Book button per free row, in the body font, 56px tall", () => {
    expect(text(html)).toContain("18:00 – 19:00");
    expect(html.match(/>Book</g)).toHaveLength(3);
    expect(html.match(/min-h-14/g)).toHaveLength(4);
    expect(html).not.toContain("font-display");
  });

  it("keeps a taken time as a faded row with Taken and no button", () => {
    expect(html.match(/opacity-60/g)).toHaveLength(1);
    expect(html).toContain(">Taken<");
    expect(text(html)).toContain("19:00 – 20:00");
  });

  it("shows each row's own price when it differs", () => {
    const mixed = text(render([pitch("a", [slot(15, "20.00"), slot(16, "25.00"), slot(17, "20.00")])]));
    expect(mixed).toContain("$25.00");
    expect(mixed.match(/\$20\.00/g)).toHaveLength(3); // two rows plus the heading
  });

  it("is in Arabic too, and names pitches only when there are several", () => {
    const ar = render([pitch("a", [slot(15)])], "ar");
    expect(ar).toContain("المساء");
    expect(ar).toContain(">احجز<");
    expect(html).not.toContain("Pitch a");
    expect(render([pitch("a", [slot(15)]), pitch("b", [slot(16)])])).toContain("Pitch b");
  });
});

describe("NextFreeCard", () => {
  const props = { dayLabel: "Today", startLocal: "5:00 PM", priceUsd: "20.00", durationMinutes: 60, onBook: () => {} };
  const card = renderToStaticMarkup(createElement(NextFreeCard, { ...props, locale: "en" }));

  it("shows the time as the one display figure, price and length, and a Book now button", () => {
    expect(card).toContain("Next free time");
    expect(card.match(/font-display/g)).toHaveLength(1);
    expect(text(card)).toContain("5:00 PM");
    expect(text(card)).toContain("$20.00 · 60 min");
    expect(card).toContain(">Book now<");
  });

  it("is in Arabic too", () => {
    const ar = renderToStaticMarkup(createElement(NextFreeCard, { ...props, dayLabel: "اليوم", startLocal: "5:00 م", locale: "ar" }));
    expect(ar).toContain("احجز الآن");
    expect(text(ar)).toContain("60 د");
  });
});
