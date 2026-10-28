/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { perPlayerViewOf } from "@/app/owner/(app)/today/_components/per-player-view";
import type { OwnerSlot } from "@/modules/booking/application/load-owner-day";
import { PerPlayerCollect } from "@/modules/booking/ui/per-player-collect";

/**
 * DR-007 slice 7: the split of a game in pounds on the sheet: the slots in pounds, Pay and Pay another
 * way, "Consider it paid" on a share under 5,000 LBP, and the dollar game as before. Written, not run
 * when authored.
 */
const D = (value: number | string) => new Decimal(value);
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function slot(n: number, due: number, paid: number, currency: "USD" | "LBP" = "LBP"): OwnerSlot {
  return {
    participantId: `p${n}`,
    slotNumber: n,
    isRequester: n === 1,
    personId: null,
    name: null,
    currency,
    due: D(due),
    paid: D(paid),
    remaining: D(due).minus(paid),
  };
}

const noop = async () => ({ ok: true as const });

function sheet(view: ReturnType<typeof perPlayerViewOf>, locale: "en" | "ar" = "en", rate: string | null = "89500") {
  return renderToStaticMarkup(
    createElement(PerPlayerCollect, {
      view,
      mayCollect: true,
      locale,
      lbpPerUsd: rate,
      submitCollectAllRemaining: noop,
      submitCollectSlot: noop,
      submitConsiderSharePaid: noop,
    }),
  );
}

function lbpView(slots: OwnerSlot[], collected: number, unassigned = 0) {
  return perPlayerViewOf({
    bookingId: "bk",
    currency: "LBP",
    mode: "PER_PLAYER",
    canSplit: true,
    defaultPlayerCount: 10,
    slots,
    due: D(slots.reduce((sum, row) => sum + Number(row.due), 0)),
    collected: D(collected),
    unassigned: D(unassigned),
  });
}

describe("the split of a game in pounds", () => {
  const slots = [slot(1, 290000, 0), slot(2, 285000, 0), slot(3, 285000, 285000)];

  it("the view holds whole pounds and the same pay states as dollars", () => {
    const view = lbpView(slots, 285000);
    expect(view.currency).toBe("LBP");
    expect(view.slots.map((row) => [row.dueUsd, row.state, row.chargeUsd, row.partial])).toEqual([
      ["290000", "pay", "290000", false],
      ["285000", "pay", "285000", false],
      ["285000", "paid", null, false],
    ]);
    expect([view.unpaidTotalUsd, view.unassignedUsd, view.hasAllocations]).toEqual(["575000", "0", true]);
  });

  it("the sheet shows the shares in pounds, with Other amount or currency and the pay-all total", () => {
    const html = text(sheet(lbpView(slots, 285000)));
    expect(html).toContain("290,000 LBP");
    expect(html).toContain("285,000 LBP");
    expect(html).toContain("Other amount or currency");
    expect(html).toContain("Booker pays all remaining 575,000 LBP");
    expect(html).not.toContain("$");
    expect(text(sheet(lbpView(slots, 285000), "ar"))).toContain("290,000 ل.ل");
  });

  it("offers Consider it paid only on a share with under 5,000 LBP left", () => {
    const nearly = [slot(1, 290000, 0), slot(2, 285000, 282000)];
    expect(text(sheet(lbpView(nearly, 282000)))).toContain("Consider it paid");
    expect(text(sheet(lbpView(nearly, 282000), "ar"))).toContain("اعتبرها مدفوعة");
    const six = [slot(1, 290000, 0), slot(2, 285000, 279000)];
    expect(text(sheet(lbpView(six, 279000)))).not.toContain("Consider it paid");
    // No rate, no way to tell for a dollar share, but pounds need none.
    expect(text(sheet(lbpView(nearly, 282000), "en", null))).toContain("Consider it paid");
  });

  it("money from before the split shows as Unassigned in pounds", () => {
    const html = text(sheet(lbpView([slot(1, 290000, 0), slot(2, 285000, 0)], 100000, 100000)));
    expect(html).toContain("100,000 LBP");
  });
});

describe("the split of a game in dollars is as before", () => {
  it("the shares read in dollars with cents", () => {
    const slots = [slot(1, 5, 0, "USD"), slot(2, 5, 0, "USD"), slot(3, 4, 4, "USD")];
    const view = perPlayerViewOf({
      bookingId: "bk",
      currency: "USD",
      mode: "PER_PLAYER",
      canSplit: true,
      defaultPlayerCount: 10,
      slots,
      due: D(14),
      collected: D(4),
      unassigned: D(0),
    });
    expect(view.slots.map((row) => [row.dueUsd, row.state])).toEqual([["5.00", "pay"], ["5.00", "pay"], ["4.00", "paid"]]);
    const html = text(sheet(view));
    expect(html).toContain("$5.00");
    expect(html).toContain("Booker pays all remaining $10.00");
    expect(html).not.toContain("Other amount or currency");
  });
});
