/** @jest-environment node */
import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { extendView } from "@/app/owner/(app)/today/_components/extend-view";
import { lbpUpcomingView } from "@/app/owner/(app)/today/_components/lbp-row-view";
import type { LbpOwnerDayBooking } from "@/modules/booking/application/load-owner-day";
import { AdjustDueForm, CancelDecisionForm, NoShowDecisionForm } from "@/modules/booking/ui/fee-forms";
import { ui } from "@/lib/copy";
import { errorMessage } from "@/lib/copy/errors";

/**
 * DR-007 slice 8: the cancel, no-show and adjust screens of a game in pounds write the fee, what was
 * collected and the due in pounds, send the amount in the field of that currency, and the extension
 * offer carries its price in pounds. Written, not run when authored.
 */
const NOW = new Date("2026-10-16T20:00:00Z");

const GAME: LbpOwnerDayBooking = {
  id: "bk_lbp",
  status: "APPROVED",
  pitchId: "p1",
  pitchName: "Pitch A",
  // Starts in two hours: inside the 24-hour window, so a player cancel pays the late fee.
  start: new Date("2026-10-16T22:00:00Z"),
  end: new Date("2026-10-16T23:00:00Z"),
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
  settledLbp: new Decimal(600000),
  remainingLbp: new Decimal(1400000),
  unassignedLbp: new Decimal(0),
};

const ROW = lbpUpcomingView(GAME, {
  items: undefined,
  itemsPanel: { tabsOwed: false, bookerPersonId: "per1", bookerName: "هدى", tabs: [] },
  now: NOW,
  locale: "en",
  hourCycle: "h23",
  openWaitlist: [],
  stadiumName: "Test Stadium",
  showPitch: false,
  dayStartHour: 6,
  extendedMinutes: 0,
  series: undefined,
  splitEnabled: true,
  policy: { cancellationWindowHours: 24, lateCancellationFeePercent: 50, noShowFeePercent: 100 },
  repeatWeekly: true,
  extend: null,
});

const text = (html: string) => html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const noop = async () => {};

describe("the sheet row of a game in pounds", () => {
  it("offers cancel (before the start), adjust and repeat weekly, with the figures in pounds", () => {
    expect([ROW.currency, ROW.showCancel, ROW.showNoShow, ROW.canAdjust, ROW.repeatWeekly]).toEqual(["LBP", true, false, true, true]);
    expect([ROW.playerFeeExact, ROW.playerFeeCompact]).toEqual(["1000000", "1000000"]);
    expect([ROW.ownerFeeExact, ROW.noShowFeeExact, ROW.priceUsd]).toEqual(["0", "2000000", "2000000"]);
    expect([ROW.collectedExact, ROW.collectedCompact]).toEqual(["600000", "600000"]);
  });
});

describe("the cancel screen in pounds", () => {
  const html = renderToStaticMarkup(
    createElement(CancelDecisionForm, {
      row: ROW,
      locale: "en",
      mayAdjust: true,
      confirmRef: null,
      onBack: () => {},
      submitCancelBooking: noop,
    }),
  );

  it("names the fee and what is kept in pounds, never in dollars", () => {
    const shown = text(html);
    expect(shown).toContain("1,000,000 LBP");
    expect(shown).not.toContain("$");
  });

  it("the WhatsApp preview names the fee in pounds", () => {
    expect(text(html)).toMatch(/1,000,000 LBP/);
  });
});

describe("the no-show screen in pounds", () => {
  it("shows the whole due as the fee, in pounds", () => {
    const html = renderToStaticMarkup(
      createElement(NoShowDecisionForm, {
        row: { ...ROW, showNoShow: true },
        locale: "en",
        mayAdjust: false,
        confirmRef: null,
        onBack: () => {},
        submitRecordNoShow: noop,
      }),
    );
    expect(text(html)).toContain("2,000,000 LBP");
    expect(text(html)).not.toContain("$");
  });
});

describe("the adjust screen in pounds", () => {
  const html = renderToStaticMarkup(
    createElement(AdjustDueForm, {
      row: ROW,
      locale: "en",
      confirmRef: null,
      onBack: () => {},
      submitAdjustBookingDue: noop,
    }),
  );

  it("sends the amount in the pounds field, starting at the current due", () => {
    expect(html).toContain('name="toLbp"');
    expect(html).not.toContain('name="toUsd"');
    expect(html).toContain('value="2000000"');
  });
});

describe("the extension offer", () => {
  it("carries the added price in the game's currency", () => {
    const offer = {
      allowed: true,
      reason: null,
      newEnd: new Date("2026-10-16T23:30:00Z"),
      addedPrice: new Decimal(1000000),
      currency: "LBP" as const,
      limit: null,
      declineCount: 0,
    };
    const view = extendView(GAME, offer, "h23", "en", true);
    expect(view).toMatchObject({ allowed: true, currency: "LBP", addedPrice: "1000000", mayEditPrice: true });
    const dollars = extendView(GAME, { ...offer, currency: "USD", addedPrice: new Decimal(15) }, "h23", "en", false);
    expect(dollars).toMatchObject({ currency: "USD", addedPrice: "15.00", mayEditPrice: false });
  });
});

describe("the copy that states the money unit", () => {
  it("is built from the one constant, in both languages, with no typed amount", () => {
    expect(errorMessage("booking.fee_unit", "en")).toBe("A fee in pounds must be a multiple of 5,000 LBP.");
    expect(errorMessage("booking.fee_unit", "ar")).toContain("5,000 ل.ل");
    expect(errorMessage("booking.not_forgivable", "en")).toContain("5,000 LBP");
    expect(ui("owner.pitchLbpUnit", "en")).toBe("Use whole pounds in steps of 5,000 LBP.");
    expect(ui("owner.pitchLbpUnit", "en")).not.toContain("{unit}");
    expect(errorMessage("venue.lbp_price_unit", "ar")).not.toContain("{unit}");
  });
});
