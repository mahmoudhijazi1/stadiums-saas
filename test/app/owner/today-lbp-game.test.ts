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
import type { CollectActions } from "@/modules/booking/ui/booking-sheet/money-block";
import { UpcomingRows } from "@/modules/booking/ui/upcoming-rows";
import { mainView } from "./game-sheet-main";

/** The text a reader sees: tags dropped (the pound sign has its own span, see LtrIsolate). */
const visible = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");

/**
 * DR-007 slice 5: an LBP game on Today shows its due in pounds on the card and in the sheet. Slice 6:
 * Collect and "Consider it paid" (under one LBP unit). Slice 7: the split. Slice 8: cancel, no-show,
 * adjust and the fee figures, in pounds. Written, not run when authored.
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
  owedUsd: new Decimal(0),
  owedLbp: new Decimal(2000000),
  currency: "LBP",
  priceLbp: new Decimal(2000000),
  amountDueLbp: new Decimal(2000000),
  settledLbp: new Decimal(0),
  remainingLbp: new Decimal(2000000),
  unassignedLbp: new Decimal(0),
};

/** The same game with 1,790,000 settled: 210,000 is left. */
const PART_PAID: LbpOwnerDayBooking = {
  ...GAME,
  owedLbp: new Decimal(210000),
  settledLbp: new Decimal(1790000),
  remainingLbp: new Decimal(210000),
};

/** The same game with 3,000 left: forgivable. */
const NEARLY_PAID: LbpOwnerDayBooking = {
  ...GAME,
  owedLbp: new Decimal(3000),
  settledLbp: new Decimal(1997000),
  remainingLbp: new Decimal(3000),
};

/** The same game settled in full. */
const SETTLED: LbpOwnerDayBooking = {
  ...GAME,
  owedLbp: new Decimal(0),
  settledLbp: new Decimal(2000000),
  remainingLbp: new Decimal(0),
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
    splitEnabled: true,
    policy: { cancellationWindowHours: 24, lateCancellationFeePercent: 50, noShowFeePercent: 100 },
    repeatWeekly: false,
    extend: null,
  });
}

const noop = async () => ({ ok: true as const });
const COLLECT_ACTIONS = {
  submitCollectPayment: async () => {},
  submitConsiderPaid: async () => {},
  submitSwitchToPerPlayer: noop,
  submitSwitchToWhole: noop,
  submitCollectSlot: noop,
  submitCollectAllRemaining: noop,
} as unknown as CollectActions;

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

/** The money area of the game sheet: the money row and the bottom bar of the main view. */
function moneyBlock(locale: UiLocale, game: LbpOwnerDayBooking = GAME) {
  return renderToStaticMarkup(mainView(viewOf(locale, game), COLLECT_ACTIONS, { locale }));
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

describe("an LBP game on Today", () => {
  it("the card's pill shows the due in pounds", () => {
    expect(viewOf("en").display.kind).toBe("unpaid");
    expect(card("en")).toContain("2,000,000 LBP");
    expect(visible(card("ar"))).toContain("2,000,000 ل.ل");
    expect(card("en")).not.toContain("$");
  });

  it("the sheet's money block shows the due in pounds, Collect and Other amount or currency (slice 6)", () => {
    const html = moneyBlock("en");
    expect(html).toContain("2,000,000 LBP");
    expect(html).toContain(ui("owner.collect", "en"));
    expect(html).toContain(ui("owner.otherAmount", "en"));
    // The quick Collect sends exactly what is left, in pounds.
    expect(html).toContain('name="lbpAmount" value="2000000"');
    expect(html).not.toContain(ui("owner.considerPaid", "en"));
    expect(visible(moneyBlock("ar"))).toContain("2,000,000 ل.ل");
  });

  it("offers Consider it paid only under 5,000 LBP, in AR and EN", () => {
    expect(moneyBlock("en", NEARLY_PAID)).toContain("Consider it paid");
    expect(moneyBlock("ar", NEARLY_PAID)).toContain("اعتبرها مدفوعة");
    expect(moneyBlock("en", PART_PAID)).not.toContain("Consider it paid");
    expect(moneyBlock("en", SETTLED)).not.toContain("Consider it paid");
    expect(moneyBlock("en", SETTLED)).not.toContain(ui("owner.collect", "en"));
  });

  it("offers the money actions again, with their figures in pounds (slice 8)", () => {
    const view = viewOf("en");
    expect(view.lbp).toEqual({ due: "2,000,000 LBP", paid: "0 LBP", settled: false, pill: "2,000,000 LBP", remaining: "2000000" });
    expect(view.currency).toBe("LBP");
    // The game ended an hour ago: it can be marked a no-show and adjusted; its cancel window is closed.
    expect([view.showCancel, view.showNoShow, view.canAdjust]).toEqual([false, true, true]);
    // The split is offered on an approved game with something due.
    expect(view.perPlayer.canSplit).toBe(true);
    expect(view.perPlayer.currency).toBe("LBP");
    // Fees are suggested in pounds and rounded to the unit: no-show 100%, a player cancel inside the window 50%.
    expect([view.noShowFeeExact, view.noShowFeeCompact]).toEqual(["2000000", "2000000"]);
    expect([view.playerFeeExact, view.ownerFeeExact, view.ownerCancelLowersFee]).toEqual(["1000000", "0", true]);
    expect([view.priceUsd, view.collectedExact, view.collectedCompact]).toEqual(["2000000", "0", "0"]);
    expect(view.extend).toBeNull();
    expect(view.repeatWeekly).toBe(false);
  });

  it("the fee figures of a part-paid game use what was settled", () => {
    const view = viewOf("en", PART_PAID);
    expect([view.collectedExact, view.collectedCompact, view.priceUsd]).toEqual(["1790000", "1790000", "2000000"]);
  });

  it("puts the pounds in the WhatsApp reminder of an ended game", () => {
    const href = viewOf("en").whatsAppHref ?? "";
    expect(decodeURIComponent(href)).toContain("2,000,000 LBP");
  });

  it("shows what is left after a settlement: 2,000,000 minus 1,790,000 is 210,000 LBP", () => {
    const view = viewOf("en", PART_PAID);
    expect(view.lbp).toEqual({ due: "210,000 LBP", paid: "1,790,000 LBP", settled: false, pill: "210,000 LBP", remaining: "210000" });
    expect(view.display.kind).toBe("partial");
    expect(moneyBlock("en", PART_PAID)).toContain("210,000 LBP");
    // The game price shows only on the muted line under the amount, never as the amount.
    expect(text(moneyBlock("en", PART_PAID))).toContain("of 2,000,000 LBP · paid 1,790,000 LBP");
  });

  it("a game settled in full reads as paid, in pounds", () => {
    const view = viewOf("en", SETTLED);
    expect(view.display.kind).toBe("paid");
    expect(view.lbp?.settled).toBe(true);
    expect(view.bookingOwes).toBe(false);
    expect(moneyBlock("en", SETTLED)).toContain("2,000,000 LBP");
  });

  it("a USD pill is unchanged", () => {
    const usd = renderToStaticMarkup(
      createElement(StatusPill, { display: { kind: "unpaid" }, amountUsd: "30", locale: "en" }),
    );
    expect(usd).toContain("$30");
  });
});
