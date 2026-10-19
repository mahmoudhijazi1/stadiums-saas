import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FreeStripPitch } from "@/modules/booking/domain/free-strip";
import { FreeStrip } from "@/modules/booking/ui/free-strip";

/**
 * Every pitch is one line of free ranges that opens its equal-width soft chips; there are no filter chips.
 * The chips are drawn only once a line is open, so their classes are checked in the source.
 */
const source = readFileSync(join(process.cwd(), "src", "modules", "booking", "ui", "free-strip.tsx"), "utf8");

function chip(startLocal: string, pending = 0) {
  return {
    startIso: `2026-10-14T${startLocal}:00.000Z`,
    endIso: `2026-10-14T${startLocal}:59.000Z`,
    startLocal,
    endLocal: startLocal,
    price: null,
    fullPrice: { currency: "USD" as const, amount: "30.00" },
    pending,
  };
}

const PITCHES: FreeStripPitch[] = ["a", "b", "c"].map((id) => ({
  pitchId: id,
  pitchName: `Pitch ${id.toUpperCase()}`,
  chips: [chip("17:00"), chip("18:00", 2)],
}));

function render(pitches = PITCHES, showPitchNames = true) {
  return renderToStaticMarkup(
    createElement(FreeStrip, {
      pitches,
      showPitchNames,
      day: "2026-10-14",
      mayBook: false,
      locale: "en",
      previewSeriesAction: async () => ({ ok: false }) as never,
      submitCreateOwnerBooking: async () => {},
    }),
  );
}

describe("FreeStrip", () => {
  const html = render();

  it("shows every pitch as its own row, whatever the pitch count, with no filter chips", () => {
    for (const name of ["Pitch A", "Pitch B", "Pitch C"]) expect(html).toContain(name);
    expect(html).not.toContain("aria-current");
    expect(html).not.toContain("?pitch=");
    expect(html).not.toContain(">All<");
  });

  it("names a pitch with type-strong, only when names are shown", () => {
    expect(html).toContain('class="type-strong"');
    expect(render(PITCHES.slice(0, 1), false)).not.toContain("type-strong");
  });

  it("is one collapsed line per pitch with its free range, and the ranges wrap with no sideways scroll", () => {
    expect(html.match(/aria-expanded="false"/g)).toHaveLength(3);
    expect(html).toContain("flex-wrap");
    expect(html).not.toContain("overflow-x-auto");
    expect(html).not.toContain("flex-nowrap");
  });

  it("opens the hours as equal-width chips that wrap", () => {
    expect(source).toContain("grid-cols-[repeat(auto-fill,minmax(7rem,1fr))]");
    expect(source).toContain("w-full");
  });

  it("sits a little lower than what is above it", () => {
    expect(html).toContain("mt-3");
  });

  it("makes soft filled chips: surface token, no border, type-label, tabular, 48px", () => {
    expect(source).toContain("bg-surface-2");
    expect(source).toContain("type-label");
    expect(source).toContain("tabular-nums");
    expect(source).toContain("min-h-12");
    expect(source).not.toContain("border-control-border");
  });

  it("keeps the badge for pending requests and the total in the heading", () => {
    expect(source).toContain("bg-action-ink");
    expect(html).toContain("(6)");
  });

  it("keeps the pressed and picked states, and uses no physical side classes", () => {
    expect(source).toContain("active:bg-accent-brand");
    expect(source).toContain('pickedClass = "bg-accent-brand text-accent-ink"');
    expect(source).not.toMatch(/\b(?:ml|mr|pl|pr|left|right|text-left|text-right)-/);
  });
});
