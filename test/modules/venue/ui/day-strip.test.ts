import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DayStrip } from "@/modules/venue/ui/day-strip";
import { lastPublicDay } from "@/modules/booking/domain/public-window";

const today = { year: 2026, month: 10, day: 14 };

function render(selectedDate: string, levels?: Record<string, 0 | 1 | 2 | 3>) {
  return renderToStaticMarkup(
    createElement(DayStrip, { today, lastDay: lastPublicDay(today), selectedDate, pathname: "/", dateQueryKey: "date", levels, locale: "en" }),
  );
}

describe("DayStrip", () => {
  const html = render("2026-10-14");

  it("starts today, has no past day, and ends on the last public day", () => {
    expect(html).toContain("date=2026-10-14");
    expect(html).not.toContain("date=2026-10-13");
    expect(html).toContain("date=2026-12-13");
    expect(html).not.toContain("date=2026-12-14");
    expect(html.match(/<a /g)).toHaveLength(61);
  });

  it("labels today and marks the selected day", () => {
    expect(html).toContain("Today");
    expect(html.match(/aria-current="date"/g)).toHaveLength(1);
    expect(render("2026-10-20")).toMatch(/aria-current="date"[^>]*>|href="\/\?date=2026-10-20"[^>]*aria-current="date"/);
  });

  it("draws no dots unless levels are given, then 3, 2, 1 dots or an empty ring", () => {
    expect(html).not.toContain("data-level");
    const dotted = render("2026-10-14", { "2026-10-14": 3, "2026-10-15": 2, "2026-10-16": 1, "2026-10-17": 0 });
    expect(dotted).toContain('data-level="3"');
    expect(dotted).toContain('data-level="2"');
    expect(dotted).toContain('data-level="1"');
    expect(dotted.match(/data-level="0"/g)).toHaveLength(58); // the day with 0 and the 57 with no entry
    expect(dotted.match(/size-1 rounded-full/g)).toHaveLength(6);
  });
});
