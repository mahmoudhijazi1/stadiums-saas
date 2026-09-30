import { describe, expect, it } from "@jest/globals";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatClockRange, formatClockRangeText } from "@/lib/format-local-hm";
import { ClockRangeText } from "@/components/ui/ltr-isolate";

// 2026-10-05 13:00 UTC = 16:00 Beirut
const start = new Date("2026-10-05T13:00:00.000Z");
const end = new Date("2026-10-05T14:00:00.000Z");

describe("Arabic clock range order", () => {
  it("reads start–end, then the single marker", () => {
    expect(formatClockRangeText(start, end, "Asia/Beirut", "h12", "ar")).toBe("4:00–5:00 م");
    expect(formatClockRange(start, end, "Asia/Beirut", "h12", "ar")).toEqual({
      digits: "4:00–5:00",
      period: "م",
    });
  });

  it("keeps each marker with its own clock across noon", () => {
    const morning = new Date("2026-10-05T08:00:00.000Z"); // 11:00
    const noon = new Date("2026-10-05T09:00:00.000Z"); // 12:00
    expect(formatClockRangeText(morning, noon, "Asia/Beirut", "h12", "ar")).toBe("11:00 ص–12:00 م");
  });

  it("renders the digits in one LTR isolate, start before end, marker after it", () => {
    const html = renderToStaticMarkup(
      createElement(ClockRangeText, { text: "4:00–5:00 م" }),
    );
    expect(html).toContain('<bdi dir="ltr"');
    expect(html.indexOf("4:00–5:00")).toBeLessThan(html.indexOf("م"));
    expect(html.indexOf("4:00")).toBeLessThan(html.indexOf("5:00"));
  });
});
