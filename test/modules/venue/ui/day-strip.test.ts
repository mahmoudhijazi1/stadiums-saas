import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DayStrip } from "@/modules/venue/ui/day-strip";
import { lastPublicDay } from "@/modules/booking/domain/public-window";

const today = { year: 2026, month: 10, day: 14 };

function render(selectedDate: string) {
  return renderToStaticMarkup(
    createElement(DayStrip, { today, lastDay: lastPublicDay(today), selectedDate, pathname: "/", dateQueryKey: "date", locale: "en" }),
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
});
