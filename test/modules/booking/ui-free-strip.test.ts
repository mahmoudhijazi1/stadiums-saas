import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { FreeStripPitch } from "@/modules/booking/domain/free-strip";
import { FreeStrip } from "@/modules/booking/ui/free-strip";

/** Written, not run. Every pitch is one scrolling row of soft chips; there are no filter chips. */
function chip(startLocal: string, pending = 0) {
  return {
    startIso: `2026-10-14T${startLocal}:00.000Z`,
    endIso: `2026-10-14T${startLocal}:59.000Z`,
    startLocal,
    endLocal: startLocal,
    priceUsd: null,
    fullPriceUsd: "30.00",
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

  it("names a pitch with type-section, only when names are shown", () => {
    expect(html).toContain('class="type-section"');
    expect(render(PITCHES.slice(0, 1), false)).not.toContain("type-section");
  });

  it("keeps each pitch's hours on one line that scrolls sideways", () => {
    expect(html.match(/flex-nowrap/g)).toHaveLength(3);
    expect(html.match(/overflow-x-auto/g)).toHaveLength(3);
    expect(html).not.toContain("flex-wrap");
  });

  it("makes soft filled chips: surface token, no border, type-label, tabular, 40px", () => {
    expect(html).toContain("bg-surface-2");
    expect(html).toContain("type-label");
    expect(html).toContain("tabular-nums");
    expect(html).toContain("min-h-10");
    expect(html).not.toContain("border-control-border");
    expect(html).not.toContain("h-9");
  });

  it("keeps the badge for pending requests and the total in the heading", () => {
    expect(html).toContain("bg-action-ink");
    expect(html).toContain("(6)");
  });

  it("keeps the pressed and picked states, and uses no physical side classes", () => {
    const source = readFileSync(join(process.cwd(), "src", "modules", "booking", "ui", "free-strip.tsx"), "utf8");
    expect(source).toContain("active:bg-accent-brand");
    expect(source).toContain('pickedClass = "bg-accent-brand text-accent-ink"');
    expect(source).not.toMatch(/\b(?:ml|mr|pl|pr|left|right|text-left|text-right)-/);
  });
});
