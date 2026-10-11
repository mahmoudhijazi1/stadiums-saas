import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TimeChips } from "@/modules/booking/ui/time-chips";
import type { SlotPickerPitch } from "@/modules/booking/ui/slot-picker";

const slot = (hour: number, priceUsd: string) => ({
  startIso: `2026-10-16T${String(hour).padStart(2, "0")}:00:00.000Z`,
  endIso: `2026-10-16T${String(hour + 1).padStart(2, "0")}:00:00.000Z`,
  startLocal: `${hour}:00`,
  endLocal: `${hour + 1}:00`,
  priceUsd,
  available: true,
});

const pitch = (id: string, slots: SlotPickerPitch["slots"]): SlotPickerPitch => ({ id, name: `Pitch ${id}`, slots, emptyKind: null });

function render(pitches: SlotPickerPitch[], locale: "ar" | "en" = "en") {
  return renderToStaticMarkup(createElement(TimeChips, { pitches, locale, onPick: () => {} }));
}

describe("TimeChips", () => {
  const html = render([pitch("a", [slot(17, "20.00"), slot(18, "20.00"), slot(19, "25.00"), slot(20, "20.00")])]);

  it("states the most common price in the heading, in both languages", () => {
    expect(html).toContain("Available times");
    expect(html).toMatch(/\$20\.00<\/bdi>? per game|\$20\.00.*per game/);
    const ar = render([pitch("a", [slot(17, "20.00")])], "ar");
    expect(ar).toContain("الأوقات المتاحة");
    expect(ar).toContain("للمباراة");
  });

  it("shows the start time only, never the end time", () => {
    expect(html).toContain("17:00");
    expect(html).not.toContain("21:00");
    expect(html.match(/<button/g)).toHaveLength(4);
  });

  it("shows a price on the chips that differ from the common one, and only on those", () => {
    // The heading carries $20.00 once; the only chip price is the 25.00 chip.
    expect(html.match(/\$25\.00/g)).toHaveLength(1);
    expect(html.match(/\$20\.00/g)).toHaveLength(1);
  });

  it("makes every chip at least 44px tall and keeps times in the body font", () => {
    expect(html.match(/min-h-11/g)).toHaveLength(4);
    expect(html).not.toContain("font-display");
  });

  it("names the pitches only when there is more than one", () => {
    expect(html).not.toContain("Pitch a");
    expect(render([pitch("a", [slot(17, "20.00")]), pitch("b", [slot(18, "20.00")])])).toContain("Pitch b");
  });
});
