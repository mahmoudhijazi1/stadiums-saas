/** @jest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import Decimal from "decimal.js";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "@jest/globals";
import { lbpUpcomingView } from "@/app/owner/(app)/today/_components/lbp-row-view";
import { perPlayerViewOf } from "@/app/owner/(app)/today/_components/per-player-view";
import type { LbpOwnerDayBooking, OwnerSlot } from "@/modules/booking/application/load-owner-day";
import { MoneyBlock } from "@/modules/booking/ui/booking-sheet/money-block";
import { collectMode, type UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";
import { PerPlayerCollect } from "@/modules/booking/ui/per-player-collect";
import { ui } from "@/lib/copy";

/**
 * One rule for both currencies: on a game that has ended (or has a fee due) Collect is the normal
 * action; before the game it is hidden behind a secondary "Collect in advance" that asks first, for the
 * whole game and for a share. "Consider it paid" needs an ended game. Written, not run when authored.
 */
const NOW = new Date("2026-10-16T20:00:00Z");
const D = (value: number | string) => new Decimal(value);

const ENDED: LbpOwnerDayBooking = {
  id: "bk_lbp",
  status: "APPROVED",
  pitchId: "p1",
  pitchName: "Pitch A",
  start: new Date("2026-10-16T18:00:00Z"),
  end: new Date("2026-10-16T19:00:00Z"),
  collectedUsd: D(0),
  tabsRemainingUsd: D(0),
  collectionMode: "WHOLE",
  pitchDefaultPlayerCount: 10,
  slots: [],
  unassignedUsd: D(0),
  requesterPersonId: "per1",
  requesterName: "Huda",
  requesterPhone: "9613111001",
  owedUsd: D(0),
  owedLbp: D(2000000),
  currency: "LBP",
  priceLbp: D(2000000),
  amountDueLbp: D(2000000),
  settledLbp: D(0),
  remainingLbp: D(2000000),
  unassignedLbp: D(0),
};
/** Starts in two hours: not played yet. */
const UPCOMING: LbpOwnerDayBooking = { ...ENDED, start: new Date("2026-10-16T22:00:00Z"), end: new Date("2026-10-16T23:00:00Z") };
/** Not played yet, with 3,000 left (forgivable if it had ended). */
const UPCOMING_NEARLY_PAID: LbpOwnerDayBooking = { ...UPCOMING, owedLbp: D(3000), settledLbp: D(1997000), remainingLbp: D(3000) };
const ENDED_NEARLY_PAID: LbpOwnerDayBooking = { ...ENDED, owedLbp: D(3000), settledLbp: D(1997000), remainingLbp: D(3000) };
const SETTLED: LbpOwnerDayBooking = { ...UPCOMING, owedLbp: D(0), settledLbp: D(2000000), remainingLbp: D(0) };

function lbpRow(game: LbpOwnerDayBooking, locale: "en" | "ar" = "en"): UpcomingRowView {
  return lbpUpcomingView(game, {
    items: undefined,
    itemsPanel: { tabsOwed: false, bookerPersonId: "per1", bookerName: "Huda", tabs: [] },
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

/** The same game as a dollar game: only the money fields change; its time state is the pounds row's. */
function usdRow(game: LbpOwnerDayBooking, remaining = "30.00"): UpcomingRowView {
  return { ...lbpRow(game), lbp: null, currency: undefined, remainingUsd: remaining, priceUsd: "30.00", bookingOwes: remaining !== "0.00" };
}

const noop = (async () => ({ ok: true as const })) as never;
const ACTIONS = {
  submitCollectPayment: noop,
  submitConsiderPaid: noop,
  submitConsiderSharePaid: noop,
  submitSwitchToPerPlayer: noop,
  submitSwitchToWhole: noop,
  submitCollectSlot: noop,
  submitCollectAllRemaining: noop,
};

function block(row: UpcomingRowView, locale: "en" | "ar" = "en") {
  return render(createElement(MoneyBlock, { row, lbpPerUsd: "89500", locale, mayCollect: true, mayAdjust: true, collectActions: ACTIONS }));
}

afterEach(cleanup);

const ADVANCE = ui("owner.collectAdvance", "en");
const QUESTION = ui("owner.collectAdvanceConfirm", "en");
const COLLECT_FORM = (view: "usd" | "lbp") => (view === "usd" ? 'name="usdAmount"' : 'name="lbpAmount"');

describe("collectMode: one function for both currencies", () => {
  it("an upcoming game is 'advance', an ended one 'primary', a settled one 'none', in dollars and in pounds alike", () => {
    expect([collectMode(lbpRow(UPCOMING)), collectMode(usdRow(UPCOMING))]).toEqual(["advance", "advance"]);
    expect([collectMode(lbpRow(ENDED)), collectMode(usdRow(ENDED))]).toEqual(["primary", "primary"]);
    expect([collectMode(lbpRow(SETTLED)), collectMode(usdRow(SETTLED, "0.00"))]).toEqual(["none", "none"]);
  });

  it("the sheet asks that one function for both currencies, with no rule of its own per currency", () => {
    const source = readFileSync(join(process.cwd(), "src", "modules", "booking", "ui", "booking-sheet", "money-block.tsx"), "utf8");
    expect(source.match(/collectMode\(row\)/g)).toHaveLength(1);
    expect(source).not.toMatch(/owesCash\(row\) && !isPerPlayer/);
  });
});

describe.each([
  ["dollars", "usd" as const, (game: LbpOwnerDayBooking) => usdRow(game)],
  ["pounds", "lbp" as const, (game: LbpOwnerDayBooking) => lbpRow(game)],
])("a game in %s", (_name, currency, rowOf) => {
  it("not played yet: 'Collect in advance', and no primary Collect, no collect form, no Pay another way", () => {
    const { container } = block(rowOf(UPCOMING));
    expect(screen.getByText(ADVANCE)).toBeTruthy();
    expect(container.innerHTML).not.toContain(COLLECT_FORM(currency));
    expect(screen.queryByText(ui("owner.payAnotherWay", "en"))).toBeNull();
    expect(screen.queryByText(QUESTION)).toBeNull();
  });

  it("the confirm asks first, and confirming opens the normal collect screen", () => {
    const { container } = block(rowOf(UPCOMING));
    fireEvent.click(screen.getByText(ADVANCE));
    expect(screen.getByText(QUESTION)).toBeTruthy();
    expect(container.innerHTML).not.toContain(COLLECT_FORM(currency));
    fireEvent.click(screen.getByRole("button", { name: ADVANCE }));
    expect(container.innerHTML).toContain(COLLECT_FORM(currency));
    expect(screen.getByText(ui("owner.payAnotherWay", "en"))).toBeTruthy();
    expect(screen.queryByText(QUESTION)).toBeNull();
  });

  it("'Not now' goes back to the single button", () => {
    const { container } = block(rowOf(UPCOMING));
    fireEvent.click(screen.getByText(ADVANCE));
    fireEvent.click(screen.getByText(ui("owner.notNow", "en")));
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(screen.getByText(ADVANCE)).toBeTruthy();
    expect(container.innerHTML).not.toContain(COLLECT_FORM(currency));
  });

  it("an ended game shows Collect with no confirm and no advance button", () => {
    const { container } = block(rowOf(ENDED));
    expect(container.innerHTML).toContain(COLLECT_FORM(currency));
    expect(screen.queryByText(ADVANCE)).toBeNull();
    expect(screen.queryByText(QUESTION)).toBeNull();
  });
});

describe("Consider it paid needs an ended game", () => {
  it("is shown on an ended game and never before the game, even after confirming the advance", () => {
    block(lbpRow(ENDED_NEARLY_PAID));
    expect(screen.getByText(ui("owner.considerPaid", "en"))).toBeTruthy();
    cleanup();

    block(lbpRow(UPCOMING_NEARLY_PAID));
    expect(screen.queryByText(ui("owner.considerPaid", "en"))).toBeNull();
    fireEvent.click(screen.getByText(ADVANCE));
    fireEvent.click(screen.getByRole("button", { name: ADVANCE }));
    expect(screen.queryByText(ui("owner.considerPaid", "en"))).toBeNull();
  });
});

describe("Arabic", () => {
  it("writes the advance button and the question in Arabic", () => {
    block(lbpRow(UPCOMING, "ar"), "ar");
    expect(screen.getByText("تحصيل مسبق")).toBeTruthy();
    fireEvent.click(screen.getByText("تحصيل مسبق"));
    expect(screen.getByText("هذه المباراة لم تُلعب بعد. تحصيل مسبق؟")).toBeTruthy();
  });
});

describe("a share of a split game", () => {
  function slot(n: number, due: number): OwnerSlot {
    return {
      participantId: `p${n}`,
      slotNumber: n,
      isRequester: n === 1,
      personId: null,
      name: null,
      currency: "LBP",
      due: D(due),
      paid: D(0),
      remaining: D(due),
    };
  }
  const view = perPlayerViewOf({
    bookingId: "bk",
    currency: "LBP",
    mode: "PER_PLAYER",
    canSplit: true,
    defaultPlayerCount: 10,
    slots: [slot(1, 290000), slot(2, 285000)],
    due: D(575000),
    collected: D(0),
    unassigned: D(0),
  });
  const shares = (advanceNeeded: boolean) =>
    render(
      createElement(PerPlayerCollect, {
        view,
        part: "slots",
        mayCollect: true,
        advanceNeeded,
        mayAdjust: true,
        locale: "en",
        lbpPerUsd: "89500",
        submitCollectAllRemaining: noop,
        submitCollectSlot: noop,
        submitConsiderSharePaid: noop,
        submitSwitchToPerPlayer: noop,
        submitSwitchToWhole: noop,
      }),
    );
  const pay = () => screen.queryAllByText(new RegExp(`^${ui("owner.payPlayer", "en")}`));

  it("before the game no share can be paid until 'Collect in advance' is confirmed", () => {
    shares(true);
    expect(screen.getByText(ADVANCE)).toBeTruthy();
    expect(pay()).toHaveLength(0);
    fireEvent.click(screen.getByText(ADVANCE));
    expect(screen.getByText(QUESTION)).toBeTruthy();
    expect(pay()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: ADVANCE }));
    expect(pay().length).toBeGreaterThan(0);
  });

  it("after the game the shares are paid as before, with no advance control", () => {
    shares(false);
    expect(screen.queryByText(ADVANCE)).toBeNull();
    expect(pay().length).toBeGreaterThan(0);
  });
});
