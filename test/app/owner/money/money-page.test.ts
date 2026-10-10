import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import { inSourceParts, showsComparison } from "@/app/owner/(app)/money/summary-card";
import { sourceName } from "@/app/owner/(app)/money/activity-map";
import { showsShopRow } from "@/app/owner/(app)/money/shop-row";
import { activityHref, moneyHref, shopHref } from "@/app/owner/(app)/money/query";
import { profitHeadline, shopRowLine, ui } from "@/lib/ui-copy";

/** Written, not run when authored. The Money page's pure pieces. */
const d = (value: string) => new Decimal(value);

describe("profit and loss labels", () => {
  it("says Profit for a profit and Loss for a loss, in both languages", () => {
    expect(profitHeadline("month", "October", false, "en")).toBe("Profit in October");
    expect(profitHeadline("month", "October", true, "en")).toBe("Loss in October");
    expect(profitHeadline("today", "", false, "en")).toBe("Profit today");
    expect(profitHeadline("week", "", true, "en")).toBe("Loss this week");
    expect(profitHeadline("month", "تشرين الأول", false, "ar")).not.toBe(profitHeadline("month", "تشرين الأول", true, "ar"));
  });
});

describe("the comparison line", () => {
  const none = { inUsd: d("0"), outUsd: d("0"), netUsd: d("0"), inBySource: [], from: "2026-09-01", to: "2026-09-30" };

  it("is hidden when the previous period has no ledger row", () => {
    expect(showsComparison({ previous: { ...none, rows: 0 } })).toBe(false);
    expect(showsComparison({ previous: undefined })).toBe(false);
  });

  it("shows when the previous period has at least one row, even a loss", () => {
    expect(showsComparison({ previous: { ...none, rows: 1 } })).toBe(true);
    expect(showsComparison({ previous: { ...none, netUsd: d("-5"), rows: 3 } })).toBe(true);
  });
});

describe("In split by source", () => {
  it("lists the sources that brought money in, and the line shows only with two or more", () => {
    const both = inSourceParts({
      inBySource: [
        { sourceType: "BOOKING", usd: d("175") },
        { sourceType: "SALE", usd: d("22") },
      ],
    });
    expect(both.map((source) => source.sourceType)).toEqual(["BOOKING", "SALE"]);
    expect(both.length > 1).toBe(true);

    const one = inSourceParts({ inBySource: [{ sourceType: "BOOKING", usd: d("175") }] });
    expect(one.length > 1).toBe(false);
  });

  it("drops a source with no money in it", () => {
    const parts = inSourceParts({
      inBySource: [
        { sourceType: "BOOKING", usd: d("50") },
        { sourceType: "SALE", usd: d("0") },
      ],
    });
    expect(parts).toHaveLength(1);
  });

  it("names the known sources and shows a future one generically instead of dropping it", () => {
    expect(sourceName("BOOKING", "en")).toBe("Games");
    expect(sourceName("SALE", "en")).toBe("Shop");
    expect(sourceName("ACADEMY", "en")).toBe(ui("owner.activityGeneric", "en"));
    expect(sourceName("toString", "en")).toBe(ui("owner.activityGeneric", "en"));
  });
});

describe("links keep the period and open the right filter", () => {
  it("In and Out open the activity page filtered, for the default month", () => {
    expect(activityHref({ period: "month", view: "usd", filter: "in" })).toBe("/owner/money/activity?filter=in");
    expect(activityHref({ period: "month", view: "usd", filter: "out" })).toBe("/owner/money/activity?filter=out");
  });

  it("keeps a named period, the view and a custom range", () => {
    expect(activityHref({ period: "week", view: "lbp", filter: "in" })).toBe("/owner/money/activity?period=week&view=lbp&filter=in");
    expect(activityHref({ from: "2026-10-01", to: "2026-10-15", filter: "out" })).toBe(
      "/owner/money/activity?from=2026-10-01&to=2026-10-15&filter=out",
    );
  });

  it("the unfiltered activity page and the shop page keep the period too", () => {
    expect(activityHref({ period: "month" })).toBe("/owner/money/activity");
    expect(shopHref({ period: "last", view: "usd" })).toBe("/owner/money/shop?period=last");
    expect(shopHref({ from: "2026-10-01", to: "2026-10-31" })).toBe("/owner/money/shop?from=2026-10-01&to=2026-10-31");
  });

  it("Money itself is unchanged", () => {
    expect(moneyHref({ period: "month", view: "usd" })).toBe("/owner/money");
    expect(moneyHref({ period: "week", view: "lbp" })).toBe("/owner/money?period=week&view=lbp");
  });
});

describe("the shop row", () => {
  it("shows only when there are sales or shop-supply expenses", () => {
    expect(showsShopRow(0, d("0"))).toBe(false);
    expect(showsShopRow(2, d("0"))).toBe(true);
    expect(showsShopRow(0, d("12.50"))).toBe(true);
  });

  it("reads 'Shop · sales $X this month' and carries the amount in both languages", () => {
    expect(shopRowLine("month", "October", "$120", "en")).toBe("Shop · sales $120 this month");
    expect(shopRowLine("today", "", "$5", "en")).toBe("Shop · sales $5 today");
    expect(shopRowLine("last", "September", "$9", "en")).toBe("Shop · sales $9 in September");
    expect(shopRowLine("month", "تشرين الأول", "$120", "ar")).toContain("$120");
    expect(shopRowLine("month", "تشرين الأول", "$120", "ar")).toContain("المتجر");
  });
});
