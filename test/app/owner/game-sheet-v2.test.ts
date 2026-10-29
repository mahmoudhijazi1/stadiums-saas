/** @jest-environment jsdom */
import Decimal from "decimal.js";
import { createElement, useRef, useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "@jest/globals";
import { lbpUpcomingView } from "@/app/owner/(app)/today/_components/lbp-row-view";
import { ui } from "@/lib/copy";
import type { LbpOwnerDayBooking } from "@/modules/booking/application/load-owner-day";
import type { CardDisplay } from "@/modules/booking/domain/card-display";
import { BookingSheet } from "@/modules/booking/ui/booking-sheet/booking-sheet";
import { gameStatus, startsIn } from "@/modules/booking/ui/booking-sheet/game-status";
import { tabsTotal } from "@/modules/booking/ui/booking-sheet/items-row";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";
import type { SheetStep } from "@/modules/booking/ui/booking-sheet/sheet-header";
import { ITEMS_ACTIONS, mainView } from "./game-sheet-main";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), back: jest.fn() }) }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

/**
 * The game sheet v2: who and what state first, facts in rows, money as one row, one action at the bottom
 * and sub-screens instead of inline expansion. Written, not run when authored.
 */
const NOW = new Date("2026-10-16T20:00:00Z");
const D = (value: number | string) => new Decimal(value);
const t = (key: string) => ui(key, "en");

const ENDED: LbpOwnerDayBooking = {
  id: "bk1",
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
const PART_PAID: LbpOwnerDayBooking = { ...ENDED, owedLbp: D(210000), settledLbp: D(1790000), remainingLbp: D(210000) };
const SETTLED: LbpOwnerDayBooking = { ...ENDED, owedLbp: D(0), settledLbp: D(2000000), remainingLbp: D(0) };
const UPCOMING: LbpOwnerDayBooking = { ...ENDED, start: new Date("2026-10-16T22:00:00Z"), end: new Date("2026-10-16T23:00:00Z") };
const CANCELLED: LbpOwnerDayBooking = { ...UPCOMING, status: "CANCELLED", owedLbp: D(0), amountDueLbp: D(0), remainingLbp: D(0) };

const OFFER = { allowed: true, disabledReason: null, expectedEndsAt: "", newRange: "", currency: "LBP" as const, addedPrice: "1000000", declineCount: 0, mayEditPrice: true };

function lbpRow(game: LbpOwnerDayBooking, over: Partial<UpcomingRowView> = {}): UpcomingRowView {
  return {
    ...lbpUpcomingView(game, {
      items: undefined,
      itemsPanel: { tabsOwed: false, bookerPersonId: "per1", bookerName: "Huda", tabs: [] },
      now: NOW,
      locale: "en",
      hourCycle: "h23",
      openWaitlist: [],
      stadiumName: "Test Stadium",
      showPitch: true,
      dayStartHour: 6,
      extendedMinutes: 0,
      series: undefined,
      splitEnabled: true,
      policy: { cancellationWindowHours: 24, lateCancellationFeePercent: 50, noShowFeePercent: 100 },
      repeatWeekly: false,
      extend: null,
    }),
    ...over,
  };
}

/** The same game in dollars ($30): only the money fields change. */
function usdRow(game: LbpOwnerDayBooking, remaining: string, paid: string, over: Partial<UpcomingRowView> = {}): UpcomingRowView {
  return { ...lbpRow(game, over), lbp: null, currency: undefined, remainingUsd: remaining, priceUsd: "30.00", collectedExact: paid, bookingOwes: remaining !== "0.00" };
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

afterEach(cleanup);

const collectBar = (container: HTMLElement) => container.querySelector('[data-slot="collect-bar"]');

describe("the status chip", () => {
  const status = (kind: CardDisplay["kind"], startInMs = 0) =>
    gameStatus({ display: (kind === "live" ? { kind, minutesLeft: 10 } : { kind }) as CardDisplay, startMs: NOW.getTime() + startInMs, nowMs: NOW.getTime(), locale: "en" });

  it("not played yet: neutral, Upcoming · in <time>", () => {
    expect(status("before", 25 * 60_000)).toEqual({ kind: "upcoming", tone: "neutral", label: "Upcoming · in 25 min" });
    expect(status("before", 2 * 3_600_000).label).toBe("Upcoming · in 2 hours");
    expect(status("before", 3 * 86_400_000).label).toBe("Upcoming · in 3 days");
  });

  it("writes the time in Arabic too", () => {
    const ar = gameStatus({ display: { kind: "before" }, startMs: NOW.getTime() + 2 * 3_600_000, nowMs: NOW.getTime(), locale: "ar" });
    expect(ar.label).toBe("قادمة · بعد ساعتين");
    expect(startsIn(NOW.getTime() + 60_000, NOW.getTime(), "ar")).toBe("بعد دقيقة");
  });

  it("running now: the accent dot, Playing now", () => {
    expect(status("live")).toEqual({ kind: "playing", tone: "accent", label: "Playing now" });
  });

  it("ended and owing: amber, unpaid or partly paid", () => {
    expect(status("unpaid")).toEqual({ kind: "unpaid", tone: "owed", label: "Ended · unpaid" });
    expect(status("partial")).toEqual({ kind: "partial", tone: "owed", label: "Ended · partly paid" });
  });

  it("fully paid: green Paid", () => {
    expect(status("paid")).toEqual({ kind: "paid", tone: "paid", label: "Paid" });
  });

  it("no-show: amber while a fee is owed, neutral without", () => {
    expect(status("no_show_unpaid")).toEqual({ kind: "no_show", tone: "owed", label: t("owner.noShow") });
    expect(status("no_show_paid")).toEqual({ kind: "no_show", tone: "neutral", label: t("owner.noShow") });
  });

  it("cancelled: neutral", () => {
    expect(status("cancelled")).toEqual({ kind: "cancelled", tone: "neutral", label: "Cancelled" });
  });
});

describe("the main view, by state, in dollars and in pounds", () => {
  const view = (row: UpcomingRowView, options: Parameters<typeof mainView>[2] = {}) => render(mainView(row, ACTIONS, options));

  it.each([
    ["pounds", lbpRow(ENDED), "Collect 2,000,000 LBP"],
    ["dollars", usdRow(ENDED, "30.00", "0.00"), "Collect $30"],
  ])("ended and owing (%s): the money row, and the bottom bar with the one primary Collect", (_name, row, label) => {
    const { container } = view(row);
    expect(collectBar(container)).not.toBeNull();
    expect(screen.getAllByRole("button", { name: label })).toHaveLength(1);
    expect(within(collectBar(container) as HTMLElement).getByText(t("owner.otherAmount"))).toBeTruthy();
    // No tiles on a game that has ended.
    expect(screen.queryByRole("button", { name: t("owner.extend") })).toBeNull();
    expect(screen.queryByText(t("owner.collectAdvance"))).toBeNull();
  });

  it.each([
    ["pounds", lbpRow(UPCOMING, { extend: OFFER })],
    ["dollars", usdRow(UPCOMING, "30.00", "0.00", { extend: OFFER })],
  ])("not played yet (%s): no bottom bar, Collect in advance in the money row, the extend tile", (_name, row) => {
    const { container } = view(row);
    expect(collectBar(container)).toBeNull();
    expect(container.querySelector("[data-tone]")?.textContent).toContain(t("owner.collectAdvance"));
    expect(screen.getByRole("button", { name: t("owner.extend") })).toBeTruthy();
  });

  it("confirming Collect in advance brings the bottom bar", () => {
    const { container } = view(lbpRow(UPCOMING));
    fireEvent.click(screen.getByText(t("owner.collectAdvance")));
    fireEvent.click(screen.getByRole("button", { name: t("owner.collectAdvance") }));
    expect(collectBar(container)).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Collect 2,000,000 LBP" })).toHaveLength(1);
  });

  it.each([
    ["pounds", lbpRow(SETTLED)],
    ["dollars", usdRow(SETTLED, "0.00", "30.00")],
  ])("paid (%s): a small green row and no bottom bar", (_name, row) => {
    const { container } = view(row);
    expect(collectBar(container)).toBeNull();
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("paid");
  });

  it("cancelled with nothing due: no money row and no bottom bar", () => {
    const { container } = view(lbpRow(CANCELLED));
    expect(collectBar(container)).toBeNull();
    expect(container.querySelector("[data-tone]")).toBeNull();
  });

  it("the facts card: time and pitch, and the weekly row only for a series", () => {
    view(lbpRow(ENDED));
    expect(screen.getByText(t("owner.factTime"))).toBeTruthy();
    expect(screen.getByText(t("owner.factPitch"))).toBeTruthy();
    expect(screen.queryByText(t("owner.factWeekly"))).toBeNull();
    cleanup();
    const series: string[] = [];
    view(lbpRow(ENDED, { series: { seriesId: "s1", line: "↻ Weekly · every Friday 20:00 · 3 left", fact: "Friday 20:00 · 3 left" } }), { steps: { onSeries: () => series.push("series") } });
    // The word "weekly" once (the row's label), no "every": the line starts at the weekday.
    expect(screen.getAllByText(/weekly/i)).toHaveLength(1);
    fireEvent.click(screen.getByText("Friday 20:00 · 3 left"));
    expect(series).toEqual(["series"]);
  });

  it("a split game: the money row opens the shares, and there is no whole-game bottom bar", () => {
    const shares: string[] = [];
    const row = lbpRow(ENDED);
    const split = { ...row, perPlayer: { ...row.perPlayer, mode: "PER_PLAYER" as const, slots: [
      { participantId: "a", slotNumber: 1, name: null, dueUsd: "1000000", remainingUsd: "0", paid: true, state: "paid" as const, chargeUsd: null, partial: false },
      { participantId: "b", slotNumber: 2, name: null, dueUsd: "1000000", remainingUsd: "1000000", paid: false, state: "pay" as const, chargeUsd: "1000000", partial: false },
    ] } };
    const { container } = view(split, { steps: { onShares: () => shares.push("shares") } });
    expect(collectBar(container)).toBeNull();
    fireEvent.click(screen.getByText("Split between 2 · 1 paid"));
    expect(shares).toEqual(["shares"]);
  });

  it("Consider it paid stays in the money row when what is left is under one unit", () => {
    const { container } = view(lbpRow({ ...ENDED, owedLbp: D(3000), settledLbp: D(1997000), remainingLbp: D(3000) }));
    expect(within(container.querySelector("[data-tone]") as HTMLElement).getByText(t("owner.considerPaid"))).toBeTruthy();
  });
});

describe("items", () => {
  const tabs = {
    tabsOwed: false,
    bookerPersonId: "per1",
    bookerName: "Huda",
    tabs: [
      { saleId: "s1", personId: "per1", name: "Huda Saleh", lines: [{ id: "l1", name: "Cola", qty: 2, currency: "USD" as const, unit: "1.50", total: "3.00" }, { id: "l2", name: "Water", qty: 1, currency: "LBP" as const, unit: "20000", total: "20000" }], remainingLbp: "20000", remainingUsd: "3.00", paidUsd: "0.00" },
      { saleId: "s2", personId: null, name: "Abu Karim", lines: [{ id: "l3", name: "Cola", qty: 1, currency: "USD" as const, unit: "1.50", total: "1.50" }], remainingLbp: "0", remainingUsd: "1.50", paidUsd: "0.00" },
    ],
  };
  const products = [{ id: "cola", name: "Cola", currency: "USD" as const, price: "1.50" }];

  it("the tabs come to a total per currency", () => {
    expect(tabsTotal(tabs)).toEqual({ lbp: D(20000), usd: D(4.5) });
  });

  it("is one summary row: the count, the first names, the total per currency; it opens the Items step", () => {
    const opened: string[] = [];
    render(mainView(lbpRow(ENDED, { items: tabs }), ACTIONS, { steps: { onItems: () => opened.push("items") } }));
    const row = screen.getByText(/Items · 2 tabs/).closest("button") as HTMLElement;
    expect(row.textContent).toContain("Huda");
    expect(row.textContent).toContain("Abu");
    expect(row.textContent).toContain("20,000 LBP + $4.50");
    fireEvent.click(row);
    expect(opened).toEqual(["items"]);
  });

  it("with no tabs: None and + Add, only inside the 60-minute window", () => {
    render(mainView(lbpRow(UPCOMING, { mayAddItems: true }), ACTIONS, { shop: { products, maySell: true } }));
    expect(screen.getByText(t("owner.itemsNone"))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("owner.itemsAdd") })).toBeTruthy();
    cleanup();
    render(mainView(lbpRow(UPCOMING, { mayAddItems: false }), ACTIONS, { shop: { products, maySell: true } }));
    expect(screen.queryByRole("button", { name: t("owner.itemsAdd") })).toBeNull();
    expect(screen.queryByText(t("owner.itemsNone"))).toBeNull();
  });
});

describe("steps instead of inline expansion", () => {
  function Sheet({ row, start = "details" }: { row: UpcomingRowView; start?: SheetStep }) {
    const [step, setStep] = useState<SheetStep>(start);
    const confirmRef = useRef<HTMLButtonElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);
    return createElement(BookingSheet, {
      sheetRow: row,
      open: true,
      onClose: () => {},
      locale: "en",
      interestOpen: false,
      sheetStep: step,
      moveStep: setStep,
      confirmRef,
      cancelRef,
      mayCollect: true,
      mayCancel: true,
      mayNoShow: true,
      mayAdjust: true,
      lbpPerUsd: "89500",
      shop: { products: [], maySell: false },
      collectActions: ACTIONS,
      extendActions: { submitExtendBooking: noop },
      itemsActions: ITEMS_ACTIONS,
      seriesActions: { loadSeriesSheetAction: noop, previewCancelRestAction: noop, previewSeriesAction: noop, submitCancelRest: noop, submitSeriesSave: noop },
      feeActions: { submitCancelBooking: noop, submitRecordNoShow: noop, submitAdjustBookingDue: noop },
    });
  }
  const back = () => fireEvent.click(screen.getByRole("button", { name: t("owner.itemsBack") }));

  it("the header: the name links to the person, one status chip, call, WhatsApp and close", () => {
    render(createElement(Sheet, { row: lbpRow(ENDED) }));
    expect(screen.getByRole("link", { name: /Huda/ }).getAttribute("href")).toBe("/owner/people/per1");
    expect(document.querySelectorAll("[data-status]")).toHaveLength(1);
    expect(screen.getByRole("link", { name: t("owner.callPlayer") })).toBeTruthy();
    expect(screen.getByRole("button", { name: t("dialog.close") })).toBeTruthy();
  });

  it("Other amount or currency opens as a step titled Collect · <name>, and the back arrow returns", () => {
    render(createElement(Sheet, { row: lbpRow(ENDED) }));
    fireEvent.click(screen.getByRole("button", { name: t("owner.otherAmount") }));
    expect(screen.getByText("Collect · Huda")).toBeTruthy();
    expect(screen.getByLabelText("LBP")).toBeTruthy();
    expect(screen.getByLabelText("$")).toBeTruthy();
    expect(document.body.textContent).toContain("$1 = 89,500 LBP");
    back();
    expect(screen.queryByText("Collect · Huda")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Collect 2,000,000 LBP" })).toHaveLength(1);
  });

  it("More actions opens as a step: the ordered list, cancel in red in its own group", () => {
    render(createElement(Sheet, { row: lbpRow(ENDED, { canAdjust: true, showNoShow: true, showCancel: true }) }));
    fireEvent.click(screen.getByRole("button", { name: t("owner.moreActions") }));
    const cancel = screen.getByRole("button", { name: t("owner.cancel") });
    expect(cancel.className).toContain("text-destructive");
    expect(screen.getByRole("button", { name: t("owner.adjustDue") }).parentElement).not.toBe(cancel.parentElement);
    back();
    expect(screen.getByRole("button", { name: t("owner.moreActions") })).toBeTruthy();
  });

  it("the Items step lists today's tabs with their Collect as a secondary button", () => {
    const items = {
      tabsOwed: true,
      bookerPersonId: "per1",
      bookerName: "Huda",
      tabs: [{ saleId: "s1", personId: "per1", name: "Huda", lines: [{ id: "l1", name: "Cola", qty: 2, currency: "USD" as const, unit: "1.50", total: "3.00" }], remainingLbp: "0", remainingUsd: "3.00", paidUsd: "0.00" }],
    };
    render(createElement(Sheet, { row: lbpRow(ENDED, { items }) }));
    fireEvent.click(screen.getByText(/Items · 1 tab/));
    const collect = screen.getByRole("button", { name: /^Collect \$3/ });
    expect(collect.innerHTML).not.toContain("bg-owed-subtle");
    back();
  });
});
