import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TimeRows } from "@/modules/booking/ui/time-rows";
import type { SlotPickerPitch } from "@/modules/booking/ui/slot-picker";

// Beirut is UTC+3 in October 2026; the hour is the UTC hour of the start.
const slot = (utcHour: number, priceUsd = "20.00", available = true, marker: "PM" | "م" | "مساءً" = "PM") => ({
  startIso: `2026-10-16T${String(utcHour).padStart(2, "0")}:00:00.000Z`,
  endIso: `2026-10-16T${String(utcHour + 1).padStart(2, "0")}:00:00.000Z`,
  startLocal: `${utcHour - 9}:00 ${marker}`,
  endLocal: `${utcHour - 8}:00 ${marker}`,
  price: { currency: "USD" as const, amount: priceUsd },
  available,
});
const pitch = (id: string, slots: SlotPickerPitch["slots"]): SlotPickerPitch => ({ id, name: `Pitch ${id}`, slots, emptyKind: null });
const text = (html: string) => html.replace(/<[^>]+>/g, "");

function render(pitches: SlotPickerPitch[], locale: "ar" | "en" = "en") {
  return renderToStaticMarkup(createElement(TimeRows, { pitches, locale, onPick: () => {} }));
}

describe("TimeRows", () => {
  const html = render([pitch("a", [slot(14), slot(15), slot(16, "20.00", false), slot(17)])]);

  it("is one list in one rounded container with thin dividers, no groups, headings or icons", () => {
    expect(html.match(/<ul/g)).toHaveLength(1);
    expect(html).toContain("divide-y divide-line");
    expect(html).toContain("rounded-xl");
    expect(html.match(/<li/g)).toHaveLength(4);
    expect(html).not.toMatch(/Evening|Afternoon|Morning|lucide-moon|lucide-sun/);
  });

  it("writes the range with the period marker once, at the end", () => {
    expect(text(html)).toContain("5:00 – 6:00 PM");
    expect(text(html)).not.toContain("5:00 PM – 6:00 PM");
    expect(text(render([pitch("a", [slot(14, "20.00", true, "م")])], "ar"))).toContain("5:00 – 6:00 م");
  });

  it("writes the Arabic range with the marker once, at the end, from the real formatter output", () => {
    const ar = text(render([pitch("a", [slot(13, "20.00", true, "مساءً")])], "ar"));
    expect(ar).toContain("4:00 – 5:00 م");
    expect(ar).not.toContain("مساءً");
  });

  it("makes each free row one pressable button of 56px or more, with a chevron and no price", () => {
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html.match(/min-h-14/g)).toHaveLength(4);
    expect(html.match(/lucide-chevron-right/g)).toHaveLength(3);
    expect(html).not.toContain("font-display");
    expect(html.match(/\$/g)).toHaveLength(1); // only the heading line
  });

  it("keeps a taken time faded, with Taken, not pressable", () => {
    expect(html.match(/opacity-60/g)).toHaveLength(1);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain(">Taken<");
  });

  it("draws Nearest as a pill with a tinted accent background and accent text", () => {
    expect(html).toMatch(/<span[^>]*rounded-full[^>]*text-action-ink[^>]*style="background-color:color-mix\(in oklab, ?var\(--brand\) \d+%, ?var\(--surface\)\)"[^>]*>Nearest</);
  });

  it("marks only the first free time of the day as Nearest", () => {
    expect(html.match(/>Nearest</g)).toHaveLength(1);
    expect(html.indexOf("Nearest")).toBeLessThan(html.indexOf("6:00 – 7:00") > -1 ? html.indexOf("6:00 – 7:00") : Infinity);
    const taken = render([pitch("a", [slot(14, "20.00", false), slot(15)])]);
    expect(taken.indexOf("Nearest")).toBeGreaterThan(taken.indexOf("Taken"));
  });

  it("heads the list with the whole-dollar price and the length", () => {
    expect(text(html)).toContain("Available times");
    expect(text(html)).toContain("$20 per game · 60 min");
    expect(text(render([pitch("a", [slot(14, "22.50")])]))).toContain("$22.50 per game");
    expect(text(render([pitch("a", [slot(14)])], "ar"))).toContain("$20 للمباراة · 60 د");
  });

  it("shows a row's price only when it differs from the heading's", () => {
    const mixed = text(render([pitch("a", [slot(14), slot(15, "25.00"), slot(16)])]));
    expect(mixed).toContain("$25");
    expect(mixed.match(/\$20/g)).toHaveLength(1);
  });

  it("names pitches only when there are several, one list each", () => {
    expect(html).not.toContain("Pitch a");
    const two = render([pitch("a", [slot(14)]), pitch("b", [slot(15)])]);
    expect(two).toContain("Pitch b");
    expect(two.match(/<ul/g)).toHaveLength(2);
  });
});
