/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatOwed } from "@/lib/format/money";
import { DebtRow } from "@/modules/booking/ui/debt-row";
import { EarlierDebtsHeader } from "@/modules/booking/ui/earlier-debts-header";
import { DebtNoticeLine } from "@/modules/booking/ui/notify-list";

/**
 * DR-007 readers slice, decision 11: what is owed is shown per currency, never converted or added,
 * and a stadium in dollars reads exactly as before. Written, not run when authored.
 */
const D = (value: number | string) => new Decimal(value);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("formatOwed", () => {
  it("dollars only reads as it always did", () => {
    expect(formatOwed({ usd: D(30), lbp: D(0) }, "en")).toBe("$30");
    expect(formatOwed({ usd: D("12.5"), lbp: D(0) }, "ar")).toBe("$12.50");
    expect(formatOwed({ usd: D(0), lbp: D(0) }, "en")).toBe("$0");
  });

  it("pounds, or both side by side, are never added", () => {
    expect(formatOwed({ usd: D(0), lbp: D(2000000) }, "en")).toBe("2,000,000 LBP");
    expect(formatOwed({ usd: D(0), lbp: D(210000) }, "ar")).toBe("210,000 ل.ل");
    expect(formatOwed({ usd: D(30), lbp: D(2000000) }, "en")).toBe("2,000,000 LBP + $30");
  });
});

describe("the debt screens in pounds", () => {
  const row = { id: "g1", dayLabel: "Yesterday", timeRange: "4:00–5:00 PM", requesterName: "Lina", owedUsd: "0", pitchName: null };
  const render = (props: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(DebtRow, { highlighted: false, open: false, onOpen: () => {}, locale: "en", ...props } as never));

  it("a debt row shows the pounds on the pill and on the Collect button", () => {
    const pill = text(render({ row: { ...row, owedText: "210,000 LBP" }, mayCollect: false }));
    expect(pill).toContain("210,000 LBP");
    expect(pill).not.toContain("$");
    expect(text(render({ row: { ...row, owedText: "210,000 LBP" }, mayCollect: true }))).toContain("Collect 210,000 LBP");
  });

  it("a debt row in dollars is unchanged", () => {
    expect(text(render({ row: { ...row, owedUsd: "30" }, mayCollect: true }))).toContain("Collect $30");
    expect(text(render({ row: { ...row, owedUsd: "30" }, mayCollect: false }))).toContain("$30");
  });

  it("the To collect header shows the total per currency, or dollars as before", () => {
    const header = (props: Record<string, unknown>) =>
      text(
        renderToStaticMarkup(
          createElement(EarlierDebtsHeader, {
            total: "30",
            hasMore: false,
            locale: "en",
            expandable: false,
            expanded: false,
            onToggle: () => {},
            ...props,
          }),
        ),
      );
    expect(header({})).toBe("To collect $30 from earlier days");
    expect(header({ totalText: "2,000,000 LBP + $30" })).toBe("To collect 2,000,000 LBP + $30 from earlier days");
  });

  it("the debt warning on a request card names the pounds", () => {
    const line = (notice: Record<string, unknown>) =>
      text(renderToStaticMarkup(createElement(DebtNoticeLine, { notice, personId: "per1", locale: "en" } as never)));
    const base = { totalCompact: "30", reasonLabel: null, dateLabel: "Friday 16 October" };
    expect(line(base)).toContain("$30");
    const pounds = line({ ...base, totalCompact: "0", totalText: "210,000 LBP" });
    expect(pounds).toContain("210,000 LBP");
    expect(pounds).not.toContain("$");
  });
});
