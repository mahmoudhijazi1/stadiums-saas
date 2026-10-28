/** @jest-environment jsdom */
import Decimal from "decimal.js";
import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "@jest/globals";
import { lbpUpcomingView } from "@/app/owner/(app)/today/_components/lbp-row-view";
import { perPlayerViewOf } from "@/app/owner/(app)/today/_components/per-player-view";
import { ui } from "@/lib/copy";
import { currencyLabel, formatLbpAmount } from "@/lib/format/money";
import type { LbpOwnerDayBooking, OwnerSlot } from "@/modules/booking/application/load-owner-day";
import { AdjustDueForm } from "@/modules/booking/ui/fee-forms";
import { MoneyBlock, MoneyCard, gameMoneyOf } from "@/modules/booking/ui/booking-sheet/money-block";
import { MoreActions, moreActionsOf } from "@/modules/booking/ui/booking-sheet/more-actions";
import { OtherAmountForm } from "@/modules/booking/ui/booking-sheet/other-amount";
import type { UpcomingRowView } from "@/modules/booking/ui/booking-sheet/row-view";
import { PerPlayerCollect } from "@/modules/booking/ui/per-player-collect";

/**
 * The booking sheet's money area, clear in both currencies: the card by state with the remaining as the
 * one big figure, one primary "Collect <amount>", the one "Other amount or currency" form (whole game and
 * share), the adjust screen, and the ordered More actions. Written, not run when authored.
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

function lbpRow(game: LbpOwnerDayBooking): UpcomingRowView {
  return lbpUpcomingView(game, {
    items: undefined,
    itemsPanel: { tabsOwed: false, bookerPersonId: "per1", bookerName: "Huda", tabs: [] },
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
    repeatWeekly: false,
    extend: null,
  });
}

/** The same game in dollars ($30): only the money fields change. */
function usdRow(game: LbpOwnerDayBooking, remaining: string, paid: string): UpcomingRowView {
  return {
    ...lbpRow(game),
    lbp: null,
    currency: undefined,
    remainingUsd: remaining,
    priceUsd: "30.00",
    collectedExact: paid,
    bookingOwes: remaining !== "0.00",
  };
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

const card = (row: UpcomingRowView) => render(createElement(MoneyCard, { money: gameMoneyOf(row), locale: "en" }));
const block = (row: UpcomingRowView) =>
  render(createElement(MoneyBlock, { row, lbpPerUsd: "89500", locale: "en", mayCollect: true, collectActions: ACTIONS }));
const body = () => document.body.textContent?.replace(/\s+/g, " ") ?? "";

describe("currencyLabel", () => {
  it("is $ for dollars in both languages, ل.ل or LBP for pounds: the unit the formatters write", () => {
    expect([currencyLabel("USD", "ar"), currencyLabel("USD", "en")]).toEqual(["$", "$"]);
    expect([currencyLabel("LBP", "ar"), currencyLabel("LBP", "en")]).toEqual(["ل.ل", "LBP"]);
    expect(formatLbpAmount("20000", "ar").endsWith(` ${currencyLabel("LBP", "ar")}`)).toBe(true);
  });
});

describe("the money card", () => {
  it.each([
    ["pounds", lbpRow(ENDED), "2,000,000 LBP"],
    ["dollars", usdRow(ENDED, "30.00", "0.00"), "$30"],
  ])("owed (%s): amber Remaining and the remaining as the figure", (_name, row, figure) => {
    const { container } = card(row);
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("owed");
    expect(body()).toContain(t("owner.remaining"));
    expect(container.querySelector(".font-display")?.textContent).toBe(figure);
    expect(body()).not.toContain(t("owner.gamePrice"));
  });

  it.each([
    ["pounds", lbpRow(PART_PAID), "210,000 LBP", "Game price 2,000,000 LBP · Paid 1,790,000 LBP"],
    ["dollars", usdRow(ENDED, "20.00", "10.00"), "$20", "Game price $30 · Paid $10"],
  ])("partial (%s): the remaining, then one muted line with the price and what was paid", (_name, row, figure, line) => {
    const { container } = card(row);
    expect(container.querySelector(".font-display")?.textContent).toBe(figure);
    expect(body()).toContain(line);
  });

  it.each([
    ["pounds", lbpRow(SETTLED)],
    ["dollars", usdRow(SETTLED, "0.00", "30.00")],
  ])("paid (%s): green Paid", (_name, row) => {
    const { container } = card(row);
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("paid");
    expect(body()).toContain(t("owner.paid"));
  });

  it.each([
    ["pounds", lbpRow(UPCOMING)],
    ["dollars", usdRow(UPCOMING, "30.00", "0.00")],
  ])("not played yet (%s): neutral Expected", (_name, row) => {
    const { container } = card(row);
    expect(container.querySelector("[data-tone]")?.getAttribute("data-tone")).toBe("expected");
    expect(body()).toContain(t("owner.expectedLabel"));
  });

  it("has no button inside", () => {
    const { container } = card(lbpRow(ENDED));
    expect(container.querySelector("button")).toBeNull();
  });
});

describe("the one primary Collect", () => {
  it.each([
    ["pounds", lbpRow(ENDED), "Collect 2,000,000 LBP", "lbpAmount", "2000000"],
    ["dollars", usdRow(ENDED, "30.00", "0.00"), "Collect $30", "usdAmount", "30.00"],
    ["dollars, part paid", usdRow(ENDED, "12.50", "17.50"), "Collect $12.50", "usdAmount", "12.50"],
  ])("names the exact remaining and sends exactly it (%s)", (_name, row, label, field, value) => {
    const { container } = block(row);
    const primary = screen.getByRole("button", { name: label });
    expect(primary.closest("form")?.querySelector(`input[name="${field}"]`)?.getAttribute("value")).toBe(value);
    // The only Collect that is not inside the other-amount form, which starts closed.
    expect(container.querySelectorAll('input[name="usdAmount"], input[name="lbpAmount"]')).toHaveLength(1);
  });

  it("a paid game has no Collect at all", () => {
    block(lbpRow(SETTLED));
    expect(screen.queryByRole("button", { name: /^Collect/ })).toBeNull();
    expect(screen.queryByText(t("owner.otherAmount"))).toBeNull();
  });

  it("before the game: no primary Collect, the secondary Collect in advance asks first (v1.9.1)", () => {
    block(lbpRow(UPCOMING));
    expect(screen.queryByRole("button", { name: /^Collect 2,000,000/ })).toBeNull();
    fireEvent.click(screen.getByText(t("owner.collectAdvance")));
    fireEvent.click(screen.getByRole("button", { name: t("owner.collectAdvance") }));
    expect(screen.getByRole("button", { name: "Collect 2,000,000 LBP" })).toBeTruthy();
  });

  it("the disclosure keeps its wording open or closed; the chevron shows the state", () => {
    block(lbpRow(ENDED));
    const toggle = screen.getByRole("button", { name: t("owner.otherAmount") });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: t("owner.otherAmount") }).getAttribute("aria-expanded")).toBe("true");
  });
});

describe("Other amount or currency", () => {
  function form(currency: "USD" | "LBP", remaining: string, rate: string | null = "89500") {
    return render(
      createElement(OtherAmountForm, {
        id: "f",
        currency,
        remaining,
        lbpPerUsd: rate,
        locale: "en",
        submit: { kind: "action", action: noop, hidden: { bookingId: "bk1" } },
      }),
    );
  }
  const lbpField = () => screen.getByLabelText("LBP") as HTMLInputElement;
  const usdField = () => screen.getByLabelText("$") as HTMLInputElement;
  const confirm = () => screen.getByRole("button", { name: /^Collect/ });

  it("labels its two fields with currencyLabel, the game's currency first and filled", () => {
    const { container } = form("LBP", "2000000");
    const labels = Array.from(container.querySelectorAll("label")).map((label) => label.textContent);
    expect(labels).toEqual(["LBP", "$"]);
    expect(lbpField().value).toBe("2,000,000");
    expect(usdField().value).toBe("");
  });

  it("shows the rate line", () => {
    form("LBP", "2000000");
    expect(body()).toContain("$1 = 89,500 LBP");
  });

  it("dollars on a pounds game say what they cover, and one line says what is still owed", () => {
    form("LBP", "2000000");
    fireEvent.change(lbpField(), { target: { value: "" } });
    fireEvent.change(usdField(), { target: { value: "20" } });
    expect(body()).toContain("$20 = 1,790,000 LBP");
    expect(body()).toContain(`${t("owner.stillOwed")} 210,000 LBP`);
    expect(screen.queryByText(t("owner.keepIt"))).toBeNull();
    expect(confirm().textContent?.replace(/\s+/g, " ")).toBe("Collect $20");
  });

  it("more than is owed: Give back, with Keep it beside it", () => {
    form("LBP", "2000000");
    fireEvent.change(lbpField(), { target: { value: "2100000" } });
    expect(body()).toContain(`${t("owner.giveBack")} 100,000 LBP`);
    fireEvent.click(screen.getByText(t("owner.keepIt")));
    expect(body()).toContain(t("owner.kept"));
  });

  it("exactly what is owed: Exact amount, and no Keep it", () => {
    form("LBP", "2000000");
    expect(body()).toContain(t("owner.exactAmount"));
    expect(screen.queryByText(t("owner.keepIt"))).toBeNull();
  });

  it("the confirm names what it records, in both currencies", () => {
    form("LBP", "2000000");
    fireEvent.change(lbpField(), { target: { value: "1790000" } });
    fireEvent.change(usdField(), { target: { value: "20" } });
    expect(confirm().textContent?.replace(/\s+/g, " ")).toBe("Collect 1,790,000 LBP + $20");
  });

  it("a dollar game: the dollars field first, filled with what is left", () => {
    const { container } = form("USD", "30.00");
    expect(Array.from(container.querySelectorAll("label")).map((label) => label.textContent)).toEqual(["$", "LBP"]);
    expect(usdField().value).toBe("30.00");
  });

  it("is the same form on a share of a split game, and pays through the share's action", async () => {
    const paid: unknown[] = [];
    const slot = (n: number, due: number): OwnerSlot => ({
      participantId: `p${n}`,
      slotNumber: n,
      isRequester: n === 1,
      personId: null,
      name: null,
      currency: "LBP",
      due: D(due),
      paid: D(0),
      remaining: D(due),
    });
    const view = perPlayerViewOf({
      bookingId: "bk1",
      currency: "LBP",
      mode: "PER_PLAYER",
      canSplit: true,
      defaultPlayerCount: 2,
      slots: [slot(1, 290000), slot(2, 285000)],
      due: D(575000),
      collected: D(0),
      unassigned: D(0),
    });
    render(
      createElement(PerPlayerCollect, {
        view,
        mayCollect: true,
        locale: "en",
        lbpPerUsd: "89500",
        submitCollectAllRemaining: noop,
        submitCollectSlot: (async (input: unknown) => {
          paid.push(input);
          return { ok: true };
        }) as never,
        submitConsiderSharePaid: noop,
      }),
    );
    fireEvent.click(screen.getAllByRole("button", { name: t("owner.otherAmount") })[0]!);
    expect(screen.getByLabelText("LBP")).toBeTruthy();
    expect(screen.getByLabelText("$")).toBeTruthy();
    expect(body()).toContain("$1 = 89,500 LBP");
    fireEvent.click(screen.getByRole("button", { name: /^Collect 290,000 LBP/ }));
    await waitFor(() => expect(paid).toHaveLength(1));
    expect(paid[0]).toMatchObject({ bookingId: "bk1", participantId: "p1", lbpAmount: "290000", usdAmount: "" });
  });
});

describe("a share of a dollar game", () => {
  it("keeps the one exact-dollar Pay and offers no other-amount form (the server takes no typed cash on a dollar share)", () => {
    const slot = (n: number): OwnerSlot => ({
      participantId: `p${n}`,
      slotNumber: n,
      isRequester: n === 1,
      personId: null,
      name: null,
      currency: "USD",
      due: D(15),
      paid: D(0),
      remaining: D(15),
    });
    const view = perPlayerViewOf({
      bookingId: "bk1",
      currency: "USD",
      mode: "PER_PLAYER",
      canSplit: true,
      defaultPlayerCount: 2,
      slots: [slot(1), slot(2)],
      due: D(30),
      collected: D(0),
      unassigned: D(0),
    });
    render(
      createElement(PerPlayerCollect, {
        view,
        mayCollect: true,
        locale: "en",
        lbpPerUsd: "89500",
        submitCollectAllRemaining: noop,
        submitCollectSlot: noop,
        submitConsiderSharePaid: noop,
      }),
    );
    expect(screen.getAllByText(t("owner.payPlayer"))).toHaveLength(2);
    expect(screen.queryByRole("button", { name: t("owner.otherAmount") })).toBeNull();
  });
});

describe("the adjust screen", () => {
  function adjust(row: UpcomingRowView) {
    return render(
      createElement(AdjustDueForm, { row, locale: "en", confirmRef: null, onBack: () => {}, submitAdjustBookingDue: noop }),
    );
  }

  it("shows the current amount and what was paid, in the game's currency", () => {
    adjust(lbpRow(PART_PAID));
    expect(body()).toContain(`${t("owner.currentAmount")}2,000,000 LBP`);
    expect(body()).toContain(`${t("owner.paidSoFar")}1,790,000 LBP`);
  });

  it("keeps the currency beside the field and the live remaining under it", () => {
    const { container } = adjust(lbpRow(PART_PAID));
    const field = screen.getByLabelText(t("owner.newDue")) as HTMLInputElement;
    expect(field.value).toBe("2,000,000");
    expect(field.parentElement?.textContent).toContain("LBP");
    expect(body()).toContain(`${t("owner.remainingWillBe")} 210,000 LBP`);
    fireEvent.change(field, { target: { value: "1900000" } });
    expect(body()).toContain(`${t("owner.remainingWillBe")} 110,000 LBP`);
    expect(container.querySelector('input[name="toLbp"]')?.getAttribute("value")).toBe("1900000");
  });

  it("shows the unit error under the field for pounds off the money unit", () => {
    adjust(lbpRow(ENDED));
    fireEvent.change(screen.getByLabelText(t("owner.newDue")), { target: { value: "1999000" } });
    expect(screen.getByRole("alert").textContent).toContain("5,000 LBP");
  });

  it("the reason chips show their state, and Save new amount waits for one", () => {
    adjust(lbpRow(ENDED));
    const save = screen.getByRole("button", { name: t("owner.saveNewAmount") }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    const chip = screen.getByRole("button", { name: t("owner.reasonDiscount") });
    expect(chip.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(save.disabled).toBe(false);
  });

  it("a dollar game shows $ beside the field", () => {
    adjust(usdRow(ENDED, "20.00", "10.00"));
    expect((screen.getByLabelText(t("owner.newDue")) as HTMLInputElement).value).toBe("30.00");
    expect(screen.getByLabelText(t("owner.newDue")).parentElement?.textContent).toContain("$");
    expect(body()).toContain(`${t("owner.remainingWillBe")} $20`);
  });
});

describe("More actions", () => {
  const offer = { allowed: true, disabledReason: null, expectedEndsAt: "", newRange: "", currency: "LBP" as const, addedPrice: "1000000", declineCount: 0, mayEditPrice: true };
  const full: UpcomingRowView = {
    ...lbpRow(ENDED),
    canAdjust: true,
    showNoShow: true,
    showCancel: true,
    repeatWeekly: true,
    extend: offer,
  };
  const may = { mayCancel: true, mayNoShow: true, mayAdjust: true };

  it("lists the rows in order, destructive last", () => {
    expect(moreActionsOf(full, may)).toEqual(["adjust", "split", "extend", "repeat", "noshow", "cancel"]);
  });

  it("hides each row exactly when its action is not available", () => {
    expect(moreActionsOf({ ...full, extend: { ...offer, allowed: false } }, may)).not.toContain("extend");
    expect(moreActionsOf({ ...full, extend: null }, may)).not.toContain("extend");
    expect(moreActionsOf(full, { ...may, mayAdjust: false })).toEqual(["extend", "repeat", "noshow", "cancel"]);
    expect(moreActionsOf({ ...full, showCancel: false }, may)).not.toContain("cancel");
    expect(moreActionsOf({ ...full, showNoShow: false }, may)).not.toContain("noshow");
  });

  function more(row: UpcomingRowView) {
    render(
      createElement(MoreActions, {
        row,
        locale: "en",
        ...may,
        cancelRef: null,
        onCancelBooking: () => {},
        onNoShow: () => {},
        onAdjust: () => {},
        onExtend: () => {},
        onRepeat: () => {},
        collectActions: ACTIONS,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: t("owner.moreActions") }));
  }

  it("renders the order on screen, with cancel in red and last", () => {
    more(full);
    const rows = Array.from(document.querySelectorAll("button, [role=switch]"))
      .map((node) => node.textContent?.trim())
      .filter((text) => text && text !== t("owner.moreActions"));
    expect(rows).toEqual([
      t("owner.adjustDue"),
      t("owner.splitPlayers"),
      t("owner.extend"),
      t("owner.repeatWeekly"),
      t("owner.noShow"),
      t("owner.cancel"),
    ]);
    expect(screen.getByRole("button", { name: t("owner.cancel") }).className).toContain("text-destructive");
  });

  it("the split is a switch row: off on a whole game, and turning it on asks how many players", () => {
    more(full);
    const split = screen.getByRole("switch", { name: t("owner.splitPlayers") });
    expect(split.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(split);
    expect(screen.getByLabelText(t("owner.playerCount"))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("owner.splitConfirm") })).toBeTruthy();
  });
});
