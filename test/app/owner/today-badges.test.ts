import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "@jest/globals";
import { extendedBadge } from "@/lib/copy";
import { StatusPill } from "@/modules/booking/ui/booking-row";
import { ExtendedMark } from "@/modules/booking/ui/extend-form";

/** Today's badges in words, and amounts left exactly as stored. Written, not run. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("the extension badge", () => {
  it("reads in words in English", () => {
    expect(extendedBadge(30, "en")).toBe("Extended 30 min");
    expect(extendedBadge(60, "en")).toBe("Extended 1 hour");
    expect(extendedBadge(90, "en")).toBe("Extended 90 min");
  });

  it("reads in words in Arabic", () => {
    expect(extendedBadge(30, "ar")).toBe("مُدّدت نصف ساعة");
    expect(extendedBadge(60, "ar")).toBe("مُدّدت ساعة");
  });

  it("is drawn on the row, and not at all for a game that was never extended", () => {
    expect(text(renderToStaticMarkup(createElement(ExtendedMark, { minutes: 30, locale: "en" })))).toContain("Extended 30 min");
    expect(renderToStaticMarkup(createElement(ExtendedMark, { minutes: 0, locale: "en" }))).toBe("");
  });
});

describe("the no-show badge", () => {
  const pill = (kind: "no_show_paid" | "no_show_unpaid", locale: "en" | "ar", amountText?: string) =>
    renderToStaticMarkup(createElement(StatusPill, { display: { kind }, amountUsd: "30.00", amountText, locale }));

  it("with the fee paid reads 'No-show · fee paid', keeping the check icon", () => {
    const html = pill("no_show_paid", "en");
    expect(text(html)).toBe("No-show · fee paid");
    expect(html).toContain("<svg");
    expect(text(pill("no_show_paid", "ar"))).toBe("لم يحضر · الرسوم مدفوعة");
  });

  it("with the fee owed still shows the amount", () => {
    expect(text(pill("no_show_unpaid", "en"))).toContain("$30.00");
  });
});

describe("amounts are shown as stored", () => {
  it("a dollar game shows its cents and a pound game its whole pounds", () => {
    const usd = renderToStaticMarkup(createElement(StatusPill, { display: { kind: "unpaid" }, amountUsd: "37.50", locale: "en" }));
    expect(text(usd)).toContain("$37.50");
    const lbp = renderToStaticMarkup(
      createElement(StatusPill, { display: { kind: "partial" }, amountUsd: "0.00", amountText: "1,790,000 LBP", locale: "en" }),
    );
    expect(text(lbp)).toContain("1,790,000 LBP");
    expect(text(lbp)).not.toContain("$");
  });
});
