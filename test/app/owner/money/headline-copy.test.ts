import { describe, expect, it } from "@jest/globals";
import { comparisonLine, profitHeadline } from "@/lib/ui-copy";
import { comparedWithLabel, periodChipLabel, rangeLabel } from "@/app/owner/(app)/money/period-label";
import { moneyHref } from "@/app/owner/(app)/money/query";

describe("profit or loss headline", () => {
  it("says Profit for a gain and Loss for a negative period, per period kind", () => {
    expect(profitHeadline("month", "October", false, "en")).toBe("Profit in October");
    expect(profitHeadline("month", "October", true, "en")).toBe("Loss in October");
    expect(profitHeadline("today", "", false, "en")).toBe("Profit today");
    expect(profitHeadline("week", "", true, "en")).toBe("Loss this week");
    expect(profitHeadline("custom", "12 Oct – 18 Oct", false, "en")).toBe("Profit, 12 Oct – 18 Oct");
    expect(profitHeadline("month", "تشرين الأول", false, "ar")).toBe("الربح في تشرين الأول");
    expect(profitHeadline("month", "تشرين الأول", true, "ar")).toBe("الخسارة في تشرين الأول");
  });

  it("compares neutrally", () => {
    expect(comparisonLine("up", "$5", "September", "en")).toBe("↑ $5 vs September");
    expect(comparisonLine("down", "$5", "September", "en")).toBe("↓ $5 vs September");
    expect(comparisonLine("same", "$0", "September", "en")).toBe("Same as September");
  });
});

describe("period labels are human, never ISO dates", () => {
  const month = { from: "2026-10-01", to: "2026-10-31" };
  it("names the month in both languages", () => {
    expect(periodChipLabel("month", month, "en")).toBe("October");
    expect(periodChipLabel("month", month, "ar")).toBe("تشرين الأول");
    expect(periodChipLabel("last", { from: "2026-09-01", to: "2026-09-30" }, "en")).toBe("September");
    expect(periodChipLabel("today", { from: "2026-10-15", to: "2026-10-15" }, "en")).toBe("Today");
    expect(periodChipLabel("week", { from: "2026-09-07", to: "2026-09-13" }, "en")).toBe("This week");
  });

  it("writes a custom range as short dates", () => {
    const label = periodChipLabel("custom", { from: "2026-10-05", to: "2026-10-20" }, "en");
    expect(label).toBe("Oct 5 – Oct 20");
    expect(label).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(rangeLabel({ from: "2026-10-05", to: "2026-10-05" }, "en")).toBe("Oct 5");
  });

  it("compares a month with the month before it by name", () => {
    expect(comparedWithLabel(month, { from: "2026-09-01", to: "2026-09-30" }, "en")).toBe("September");
    expect(comparedWithLabel({ from: "2026-09-07", to: "2026-09-13" }, { from: "2026-08-31", to: "2026-09-06" }, "en")).toBe(
      "the previous period",
    );
  });
});

describe("moneyHref", () => {
  it("keeps the period, the view and a custom range in the URL", () => {
    expect(moneyHref({})).toBe("/owner/money");
    expect(moneyHref({ period: "month" })).toBe("/owner/money");
    expect(moneyHref({ period: "week", view: "lbp" })).toBe("/owner/money?period=week&view=lbp");
    expect(moneyHref({ period: "custom", from: "2026-10-05", to: "2026-10-20" })).toBe(
      "/owner/money?from=2026-10-05&to=2026-10-20",
    );
    expect(moneyHref({ filter: "in" }, { new: "1" })).toBe("/owner/money?filter=in&new=1");
  });
});
