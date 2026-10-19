import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import { mapActivityEntry, sourceName } from "@/app/owner/(app)/money/_components/activity-map";
import { ui } from "@/lib/copy";
import { giveBackText } from "@/lib/copy/helpers";
import { LbpGameBalance } from "@/modules/booking/ui/booking-sheet/lbp-collect";
import type { LedgerEntryRow } from "@/modules/ledger/infrastructure/entries";
import { TenderBalance } from "@/modules/payment/ui/tender-balance";

/** DR-007 decision 15, "keep it": the wording, the activity row and the control on the games' collect screens. */
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("the words", () => {
  it("Kept replaces Give back; the control and the row have their own words in both languages", () => {
    expect(giveBackText({ usd: "20.00", lbp: "0" }, "en")).toMatch(/^Give back /);
    expect(giveBackText({ usd: "20.00", lbp: "0" }, "en", true)).toMatch(/^Kept /);
    expect(giveBackText({ usd: "0", lbp: "0" }, "en", true)).toBeUndefined();
    expect(ui("owner.keepIt", "en")).toBe("Keep it");
    expect(ui("owner.keepIt", "ar")).toBe("خلّيها");
    expect(ui("owner.activityKeptChange", "en")).toBe("Kept change");
    expect(ui("owner.activityKeptChange", "ar")).toBe("فراطة متروكة");
    expect(sourceName("KEPT_CHANGE", "en")).toBe("Kept change");
  });
});

describe("an Activity row of kept change", () => {
  const entry: LedgerEntryRow = {
    id: "e1",
    direction: "IN",
    amountUsd: new Decimal("1.12"),
    occurredAt: new Date("2026-10-05T10:00:00.000Z"),
    sourceType: "KEPT_CHANGE",
    sourceId: "b1",
    paymentId: "p1",
  };

  it("is labelled Kept change and shows the change in its real currency", () => {
    const context = {
      bookings: new Map([["b1", { id: "b1", requesterName: "Lina", businessDay: "2026-10-05" }]]),
      expenses: new Map(),
      sales: new Map(),
      kept: new Map([["e1", [{ currency: "LBP" as const, amount: new Decimal("100000") }]]]),
    };
    const row = mapActivityEntry(entry, context as never, "en");
    expect(row).toMatchObject({ label: "Lina", secondary: "Kept change", icon: "booking", direction: "IN", amountText: "+100,000 LBP" });
  });
});

describe("the Keep it control", () => {
  const balance = (props: { kept?: boolean; onKeptChange?: (kept: boolean) => void }) =>
    text(
      renderToStaticMarkup(
        createElement(LbpGameBalance, {
          remainingLbp: new Decimal(2000000),
          usdText: "",
          lbpText: "2100000",
          lbpPerUsd: "89500",
          locale: "en",
          ...props,
        }),
      ),
    );

  it("a game in pounds with change offers Keep it next to Give back, and says Kept once it is on", () => {
    const off = balance({ kept: false, onKeptChange: () => {} });
    expect(off).toContain("Give back");
    expect(off).toContain("Keep it");
    const on = balance({ kept: true, onKeptChange: () => {} });
    expect(on).toContain("Kept");
    expect(on).not.toContain("Give back");
  });

  it("without the handler (any other screen) there is no Keep it", () => {
    expect(balance({})).toContain("Give back");
    expect(balance({})).not.toContain("Keep it");
  });

  it("with no change there is nothing to keep", () => {
    const html = text(
      renderToStaticMarkup(
        createElement(LbpGameBalance, {
          remainingLbp: new Decimal(2000000),
          usdText: "",
          lbpText: "2000000",
          lbpPerUsd: "89500",
          locale: "en",
          kept: false,
          onKeptChange: () => {},
        }),
      ),
    );
    expect(html).not.toContain("Keep it");
    expect(html).not.toContain("Give back");
  });

  it("the dollar form offers it only when asked to (the shop and expenses do not)", () => {
    const render = (props: { onKeptChange?: (kept: boolean) => void }) =>
      text(
        renderToStaticMarkup(
          createElement(TenderBalance, { usdText: "50", lbpText: "", lbpPerUsd: "89500", targetUsd: "30.00", locale: "en", ...props }),
        ),
      );
    expect(render({ onKeptChange: () => {} })).toContain("Keep it");
    expect(render({})).toContain("Give back");
    expect(render({})).not.toContain("Keep it");
  });
});
