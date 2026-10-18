/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { lbpUpcomingView } from "@/app/owner/(app)/today/_components/lbp-row-view";
import { ui } from "@/lib/copy";
import type { UiLocale } from "@/lib/locale";
import type { LbpOwnerDayBooking } from "@/modules/booking/application/load-owner-day";
import { StatusPill } from "@/modules/booking/ui/booking-row";
import { MoneyBlock } from "@/modules/booking/ui/booking-sheet/money-block";
import { UpcomingRows } from "@/modules/booking/ui/upcoming-rows";

/**
 * DR-007 slice 5: an LBP game on Today shows its due in pounds on the card and in the sheet, and its
 * money actions are hidden. Written, not run when authored.
 */
const NOW = new Date("2026-10-16T20:00:00Z");

/** A game that ended an hour ago, 2,000,000 LBP, nothing paid. */
const GAME: LbpOwnerDayBooking = {
  id: "bk_lbp",
  status: "APPROVED",
  pitchId: "p1",
  pitchName: "Pitch A",
  start: new Date("2026-10-16T18:00:00Z"),
  end: new Date("2026-10-16T19:00:00Z"),
  collectedUsd: new Decimal(0),
  tabsRemainingUsd: new Decimal(0),
  collectionMode: "WHOLE",
  pitchDefaultPlayerCount: 10,
  slots: [],
  unassignedUsd: new Decimal(0),
  requesterPersonId: "per1",
  requesterName: "هدى",
  requesterPhone: "9613111001",
  currency: "LBP",
  priceLbp: new Decimal(2000000),
  amountDueLbp: new Decimal(2000000),
};

function viewOf(locale: UiLocale, game: LbpOwnerDayBooking = GAME) {
  return lbpUpcomingView(game, {
    items: undefined,
    itemsPanel: { tabsOwed: true, bookerPersonId: game.requesterPersonId, bookerName: game.requesterName, tabs: [] },
    now: NOW,
    locale,
    hourCycle: "h23",
    openWaitlist: [],
    stadiumName: "Test Stadium",
    showPitch: false,
    dayStartHour: 6,
    extendedMinutes: 0,
    series: undefined,
  });
}

const noop = async () => ({ ok: true as const });
const COLLECT_ACTIONS = {
  submitCollectPayment: async () => {},
  submitSwitchToPerPlayer: noop,
  submitSwitchToWhole: noop,
  submitCollectSlot: noop,
  submitCollectAllRemaining: noop,
} as unknown as Parameters<typeof MoneyBlock>[0]["collectActions"];

function card(locale: UiLocale) {
  return renderToStaticMarkup(
    createElement(UpcomingRows, {
      rows: [viewOf(locale)],
      openId: null,
      onOpen: () => {},
      onOpenInterests: () => {},
      locale,
      rowKeyPrefix: "game",
    }),
  );
}

function moneyBlock(locale: UiLocale) {
  return renderToStaticMarkup(
    createElement(MoneyBlock, {
      row: viewOf(locale),
      lbpPerUsd: "89500",
      locale,
      mayCollect: true,
      mayAdjust: true,
      collectActions: COLLECT_ACTIONS,
    }),
  );
}

describe("an LBP game on Today", () => {
  it("the card's pill shows the due in pounds", () => {
    expect(viewOf("en").display.kind).toBe("unpaid");
    expect(card("en")).toContain("2,000,000 LBP");
    expect(card("ar")).toContain("2,000,000 ل.ل");
    expect(card("en")).not.toContain("$");
  });

  it("the sheet's money block shows the due in pounds and no Collect", () => {
    const html = moneyBlock("en");
    expect(html).toContain("2,000,000 LBP");
    expect(html).not.toContain(ui("owner.collect", "en"));
    expect(html).not.toContain(ui("owner.payAnotherWay", "en"));
    expect(moneyBlock("ar")).toContain("2,000,000 ل.ل");
  });

  it("hides every money action that is refused on an LBP game", () => {
    const view = viewOf("en");
    expect(view.lbp).toEqual({ due: "2,000,000 LBP", pill: "2,000,000 LBP" });
    expect(view.showCancel).toBe(false);
    expect(view.showNoShow).toBe(false);
    expect(view.canAdjust).toBe(false);
    expect(view.extend).toBeNull();
    expect(view.perPlayer.canSplit).toBe(false);
    expect(view.mayAddItems).toBe(false);
    expect(view.repeatWeekly).toBe(false);
  });

  it("puts the pounds in the WhatsApp reminder of an ended game", () => {
    const href = viewOf("en").whatsAppHref ?? "";
    expect(decodeURIComponent(href)).toContain("2,000,000 LBP");
  });

  it("a USD pill is unchanged", () => {
    const usd = renderToStaticMarkup(
      createElement(StatusPill, { display: { kind: "unpaid" }, amountUsd: "30", locale: "en" }),
    );
    expect(usd).toContain("$30");
  });
});
