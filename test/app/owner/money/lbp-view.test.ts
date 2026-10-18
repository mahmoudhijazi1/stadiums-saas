import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import { mapActivityEntry, keptText, type ActivityContext } from "@/app/owner/(app)/money/_components/activity-map";
import { readPeriodQuery, withDefaultView } from "@/app/owner/(app)/money/_components/period-url";
import { ShopRow } from "@/app/owner/(app)/money/_components/shop-row";
import { SummaryCard } from "@/app/owner/(app)/money/_components/summary-card";
import { moneyHref } from "@/app/owner/(app)/money/query";
import type { LedgerEntryRow } from "@/modules/ledger/infrastructure/entries";
import { lbpTotals, type LbpTenderSums } from "@/modules/payment/domain/lbp-period";
import type { KeptPart } from "@/modules/payment/domain/entry-payments";

/** DR-007: the Money page opens on the stadium's currency, counts pounds per payment, and Activity shows what was kept. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const lbp = (amount: string): KeptPart => ({ currency: "LBP", amount: new Decimal(amount) });
const usd = (amount: string): KeptPart => ({ currency: "USD", amount: new Decimal(amount) });

describe("the view the page opens on", () => {
  it("an LBP stadium opens on LBP and a USD stadium on USD, when the URL has no view", () => {
    expect(withDefaultView(readPeriodQuery({}), "LBP").view).toBe("lbp");
    expect(withDefaultView(readPeriodQuery({}), "USD").view).toBe("usd");
    expect(withDefaultView(readPeriodQuery({ period: "week" }), "LBP")).toMatchObject({ period: "week", view: "lbp" });
  });

  it("an explicit ?view= wins, in both directions", () => {
    expect(withDefaultView(readPeriodQuery({ view: "usd" }), "LBP").view).toBe("usd");
    expect(withDefaultView(readPeriodQuery({ view: "lbp" }), "USD").view).toBe("lbp");
  });

  it("an old link (no view) parses, and a malformed query still falls back to the stadium's view", () => {
    expect(readPeriodQuery({ period: "month" }).view).toBeUndefined();
    expect(withDefaultView(readPeriodQuery({ view: "euro" }), "LBP").view).toBe("lbp");
  });

  it("links keep the choice, including a dollar choice on a stadium that opens on pounds", () => {
    expect(moneyHref({ period: "week", view: "usd" })).toBe("/owner/money?period=week&view=usd");
    expect(moneyHref({ period: "week", view: "lbp" })).toBe("/owner/money?period=week&view=lbp");
    expect(moneyHref({ period: "week" })).toBe("/owner/money?period=week");
  });
});

describe("the main amount of an Activity row", () => {
  it("a payment in pounds shows pounds, a payment in dollars shows dollars", () => {
    expect(keptText("IN", [lbp("2000000")], "22.35", "en")).toBe("+2,000,000 LBP");
    expect(keptText("IN", [usd("20.00")], "20.00", "en")).toBe("+$20");
    expect(keptText("IN", [usd("12.50")], "12.50", "en")).toBe("+$12.50");
  });

  it("a mixed payment shows both parts and never one added figure", () => {
    expect(keptText("IN", [usd("20.00"), lbp("1500000")], "36.67", "en")).toBe("+$20 + 1,500,000 LBP");
  });

  it("an expense has a minus sign, in the currency it was paid in", () => {
    expect(keptText("OUT", [lbp("500000")], "5.59", "en")).toBe("−500,000 LBP");
    expect(keptText("OUT", [usd("12.50")], "12.50", "en")).toBe("−$12.50");
  });

  it("a row with no payment behind it falls back to the ledger's dollars", () => {
    expect(keptText("IN", undefined, "30.00", "en")).toBe("+$30");
    expect(keptText("OUT", [], "12.50", "en")).toBe("−$12.50");
  });

  it("Arabic writes the pound sign as the Arabic unit", () => {
    expect(keptText("IN", [lbp("2000000")], "22.35", "ar")).not.toContain("LBP");
  });
});

describe("mapActivityEntry", () => {
  const entry = (over: Partial<LedgerEntryRow>): LedgerEntryRow => ({
    id: "e1",
    direction: "IN",
    amountUsd: new Decimal("22.35"),
    occurredAt: new Date("2026-10-05T10:00:00.000Z"),
    sourceType: "BOOKING",
    sourceId: "b1",
    ...over,
  });
  const context = (kept: Record<string, KeptPart[]>, expenses: ActivityContext["expenses"] = new Map()): ActivityContext => ({
    bookings: new Map(),
    expenses,
    sales: new Map(),
    kept: new Map(Object.entries(kept)),
  });

  it("a row paid in pounds shows pounds; the dollars stay in the ledger fields", () => {
    const row = mapActivityEntry(entry({}), context({ e1: [lbp("2000000")] }), "en");
    expect(row.amountText).toBe("+2,000,000 LBP");
    expect(row.amountUsd).toBe("22.35");
  });

  it("a mixed payment shows both parts", () => {
    const row = mapActivityEntry(entry({ id: "e2" }), context({ e2: [usd("20.00"), lbp("1500000")] }), "en");
    expect(row.amountText).toBe("+$20 + 1,500,000 LBP");
  });

  it("an expense paid in pounds shows minus pounds, and its details still show the dollar equivalent and the rate", () => {
    const expenses: ActivityContext["expenses"] = new Map([
      [
        "x1",
        {
          id: "x1",
          category: "SHOP_SUPPLIES",
          description: "Water",
          occurredAt: new Date("2026-10-05T00:00:00.000Z"),
          tenders: [{ currency: "LBP", amount: new Decimal("500000"), rateAtTime: new Decimal("89500"), usdEquivalent: new Decimal("5.59") }],
        },
      ],
    ]);
    const row = mapActivityEntry(
      entry({ id: "e3", direction: "OUT", sourceType: "EXPENSE", sourceId: "x1", amountUsd: new Decimal("5.59") }),
      context({ e3: [lbp("500000")] }, expenses),
      "en",
    );
    expect(row.amountText).toBe("−500,000 LBP");
    if (row.open?.kind !== "expense") throw new Error("expected an expense sheet");
    expect(row.open.detail.tenders).toEqual([{ currency: "LBP", amount: "500000", rate: "89500", usd: "5.59" }]);
    expect(row.open.detail.amountUsd).toBe("5.59");
  });

  it("without the kept map the row shows the ledger's dollars", () => {
    const row = mapActivityEntry(entry({ amountUsd: new Decimal("30.00") }), { bookings: new Map(), expenses: new Map(), sales: new Map() }, "en");
    expect(row.amountText).toBe("+$30");
  });
});

describe("the summary card in the LBP view", () => {
  const rows = (over: Partial<LbpTenderSums> = {}): LbpTenderSums[] => [
    { sourceType: "BOOKING", ratedLbp: new Decimal("3800000"), unratedUsd: new Decimal(0), unrated: 0, payments: 2, ...over },
    { sourceType: "SALE", ratedLbp: new Decimal("1000000"), unratedUsd: new Decimal(0), unrated: 0, payments: 1 },
    { sourceType: "EXPENSE", ratedLbp: new Decimal("500000"), unratedUsd: new Decimal(0), unrated: 0, payments: 1 },
  ];
  const range = { from: "2026-10-01", to: "2026-10-31" };
  const before = { from: "2026-09-01", to: "2026-09-30" };
  const summary = {
    inUsd: new Decimal("52.35"),
    outUsd: new Decimal("5.59"),
    netUsd: new Decimal("46.76"),
    inBySource: [
      { sourceType: "BOOKING", usd: new Decimal("42.35") },
      { sourceType: "SALE", usd: new Decimal("10.00") },
    ],
    rows: 4,
    ...range,
  };
  const render = (view: "usd" | "lbp", pounds: ReturnType<typeof lbpTotals> & { previous?: ReturnType<typeof lbpTotals> }) =>
    text(
      renderToStaticMarkup(
        createElement(SummaryCard, { summary, kind: "month", view, lbpPerUsd: new Decimal(95000), lbp: pounds, locale: "en" }),
      ),
    );

  it("shows Profit, In, Out and the shop from the per-payment read, with the line under the figure", () => {
    const pounds = { ...lbpTotals(rows(), new Decimal(95000), range), previous: lbpTotals([], null, before) };
    const html = render("lbp", pounds);
    expect(html).toContain("4,300,000 LBP");
    expect(html).toContain("4,800,000 LBP");
    expect(html).toContain("500,000 LBP");
    expect(html).toContain("Each payment at its own day's rate");
    expect(html).not.toContain("converted at today's rate");
    expect(html).not.toContain("$");
    // Not the ledger times today's rate: 46.76 x 95,000 = 4,442,200.
    expect(html).not.toContain("4,442,200");
  });

  it("says how many dollar payments had no stored rate and were counted at today's rate", () => {
    const pounds = { ...lbpTotals(rows({ unratedUsd: new Decimal(4), unrated: 1 }), new Decimal(95000), range), previous: lbpTotals([], null, before) };
    expect(render("lbp", pounds)).toContain("1 converted at today's rate");
  });

  it("compares with the previous period by the same method, and hides the comparison when it had no payments", () => {
    const previous = lbpTotals([{ sourceType: "BOOKING", ratedLbp: new Decimal("1850000"), unratedUsd: new Decimal(0), unrated: 0, payments: 2 }], null, before);
    const withBefore = render("lbp", { ...lbpTotals(rows(), null, range), previous });
    // Profit 4,300,000 against 1,850,000: up 2,450,000.
    expect(withBefore).toContain("2,450,000 LBP");
    const none = render("lbp", { ...lbpTotals(rows(), null, range), previous: lbpTotals([], null, before) });
    expect(none).not.toContain("2,450,000");
  });

  it("the USD view keeps the ledger's dollars and shows no pounds line", () => {
    const pounds = { ...lbpTotals(rows(), null, range), previous: lbpTotals([], null, before) };
    const html = render("usd", pounds);
    expect(html).toContain("$46.76");
    expect(html).toContain("$52.35");
    expect(html).not.toContain("Each payment at its own day's rate");
  });
});

describe("the shop card in the LBP view", () => {
  const render = (props: { salesLbp?: Decimal }) =>
    text(
      renderToStaticMarkup(
        createElement(ShopRow, { salesUsd: new Decimal("10.00"), kind: "month", range: { from: "2026-10-01", to: "2026-10-31" }, view: "lbp", locale: "en", ...props }),
      ),
    );

  it("shows what the shop took in pounds, and dollars when no pounds figure is given", () => {
    expect(render({ salesLbp: new Decimal("1000000") })).toContain("1,000,000 LBP");
    expect(render({})).toContain("$10");
  });
});
