/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { AddItemsSheet, type TabPayer } from "@/modules/booking/ui/add-items-sheet";
import { BookingItems, type BookingItemsPanelView, type ItemsActions } from "@/modules/booking/ui/booking-items";
import type { SellItem } from "@/modules/shop/ui/item-tiles";
import { ui } from "@/lib/copy";

jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), back: jest.fn() }) }));

/**
 * The shop on a game: items first, then three ways out ("Pay now", "On a tab" with the booker and the
 * tabs already on this game, "New" with one field), and the "Tabs on this game" list. Written, not run
 * when authored.
 */
const PRODUCTS: SellItem[] = [
  { id: "cola", name: "Cola", currency: "USD", price: "1.50" },
  { id: "water", name: "Water", currency: "LBP", price: "20000" },
];

type Sent = Record<string, unknown>;
let added: Sent[];
let sold: Sent[];
const submitAddBookingItems = async (input: unknown) => {
  added.push(input as Sent);
  return { ok: true as const, itemCount: 1 };
};
const submitWalkInSale = async (input: unknown) => {
  sold.push(input as Sent);
  return { ok: true as const, itemCount: 1, totalLbp: "0", totalUsdPart: "1.50", changeLbp: "0", changeUsd: "0.00" };
};

function sheet(tabPayers: TabPayer[] = [], locale: "en" | "ar" = "en") {
  return render(
    createElement(AddItemsSheet, {
      open: true,
      onClose: () => {},
      bookingId: "bk1",
      bookerName: "Huda",
      bookerPersonId: "per_huda",
      tabPayers,
      products: PRODUCTS,
      lbpPerUsd: "89500",
      locale,
      onDone: () => {},
      submitAddBookingItems,
      submitWalkInSale: submitWalkInSale as never,
    }),
  );
}

const tile = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const text = (value: string) => screen.getByText(value);
const t = (key: Parameters<typeof ui>[0]) => ui(key, "en");

beforeEach(() => {
  added = [];
  sold = [];
});
afterEach(cleanup);

describe("step 1: items", () => {
  it("shows the tiles and a bar with the total per currency; Next waits for an item", () => {
    sheet();
    const next = screen.getByRole("button", { name: new RegExp(t("owner.itemsNext")) }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(tile("Cola"));
    fireEvent.click(tile("Cola"));
    fireEvent.click(tile("Water"));
    expect(next.disabled).toBe(false);
    expect(document.body.textContent).toContain("20,000 LBP + $3");
    expect(screen.queryByText(t("owner.itemsPayNow"))).toBeNull();
  });
});

describe("step 2: two ways out", () => {
  it("offers Pay now and On a tab as two large buttons, and nothing to type", () => {
    sheet();
    fireEvent.click(tile("Cola"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t("owner.itemsNext")) }));
    expect(text(t("owner.itemsPayNow"))).toBeTruthy();
    expect(text(t("owner.itemsOnTab"))).toBeTruthy();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("writes them in Arabic", () => {
    sheet([], "ar");
    fireEvent.click(screen.getByRole("button", { name: /^Cola/ }));
    fireEvent.click(screen.getByRole("button", { name: /التالي/ }));
    expect(text("ادفع الآن")).toBeTruthy();
    expect(text("على الحساب")).toBeTruthy();
  });
});

describe("Pay now", () => {
  it("records a walk-in sale: ids and quantities, the amounts handed over, no payer, no name, no phone", async () => {
    sheet();
    fireEvent.click(tile("Cola"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t("owner.itemsNext")) }));
    fireEvent.click(text(t("owner.itemsPayNow")));
    expect(screen.queryByPlaceholderText(t("owner.itemsNameOrNickname"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("owner.collect")}`) }));
    await waitFor(() => expect(sold).toHaveLength(1));
    expect(sold[0]).toEqual({ lines: [{ productId: "cola", qty: 1 }], usdAmount: "1.50", lbpAmount: "" });
    expect(added).toHaveLength(0);
  });
});

describe("On a tab", () => {
  function toChooser(tabPayers: TabPayer[]) {
    sheet(tabPayers);
    fireEvent.click(tile("Cola"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t("owner.itemsNext")) }));
    fireEvent.click(text(t("owner.itemsOnTab")));
  }
  const group = () => screen.getByRole("group", { name: t("owner.itemsOnTab") });
  const labels = () => Array.from(group().querySelectorAll("button")).map((button) => button.textContent);

  it("lists the booker, exactly the tabs on this game, and New last", () => {
    toChooser([
      { personId: "per_huda", name: "Huda" },
      { personId: "per_ali", name: "Ali" },
      { personId: null, name: "Abu Karim" },
    ]);
    expect(labels()).toEqual(["Huda", "Ali", "Abu Karim", t("owner.itemsNew")]);
    expect(screen.getByRole("button", { name: "Huda" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("with no other tab it is the booker and New", () => {
    toChooser([]);
    expect(labels()).toEqual(["Huda", t("owner.itemsNew")]);
  });

  it("adds to the booker's tab by default, with no typing", async () => {
    toChooser([]);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("owner.addWord")}`) }));
    await waitFor(() => expect(added).toHaveLength(1));
    expect(added[0]).toEqual({ bookingId: "bk1", lines: [{ productId: "cola", qty: 1 }], payer: { kind: "game" } });
    expect(sold).toHaveLength(0);
  });

  it("a second item for someone who already has a tab is one tap on their name", async () => {
    toChooser([{ personId: "per_ali", name: "Ali" }]);
    fireEvent.click(screen.getByRole("button", { name: "Ali" }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("owner.addWord")}`) }));
    await waitFor(() => expect(added).toHaveLength(1));
    expect(added[0]!.payer).toEqual({ kind: "person", personId: "per_ali" });
  });

  it("a tab under a typed name is reached by that name", async () => {
    toChooser([{ personId: null, name: "Abu Karim" }]);
    fireEvent.click(screen.getByRole("button", { name: "Abu Karim" }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("owner.addWord")}`) }));
    await waitFor(() => expect(added).toHaveLength(1));
    expect(added[0]!.payer).toEqual({ kind: "name", name: "Abu Karim" });
  });
});

describe("New", () => {
  function toNew() {
    sheet();
    fireEvent.click(tile("Cola"));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(t("owner.itemsNext")) }));
    fireEvent.click(text(t("owner.itemsOnTab")));
    fireEvent.click(text(t("owner.itemsNew")));
  }

  it("is one focused field; the phone is hidden behind + Phone", () => {
    toNew();
    const field = screen.getByLabelText(t("owner.itemsNameOrNickname"));
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(document.activeElement).toBe(field);
    expect(screen.queryByLabelText(t("owner.itemsPhoneField"))).toBeNull();
    fireEvent.click(text(t("owner.itemsPlusPhone")));
    expect(screen.getByLabelText(t("owner.itemsPhoneField"))).toBeTruthy();
  });

  it("adds with only a nickname: no phone is sent", async () => {
    toNew();
    const add = screen.getByRole("button", { name: new RegExp(`^${t("owner.addWord")}`) }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(t("owner.itemsNameOrNickname")), { target: { value: "Abu Ali" } });
    fireEvent.click(add);
    await waitFor(() => expect(added).toHaveLength(1));
    expect(added[0]!.payer).toEqual({ kind: "name", name: "Abu Ali" });
  });

  it("an optional phone goes along when it is typed", async () => {
    toNew();
    fireEvent.change(screen.getByLabelText(t("owner.itemsNameOrNickname")), { target: { value: "Abu Ali" } });
    fireEvent.click(text(t("owner.itemsPlusPhone")));
    fireEvent.change(screen.getByLabelText(t("owner.itemsPhoneField")), { target: { value: "03 111 222" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${t("owner.addWord")}`) }));
    await waitFor(() => expect(added).toHaveLength(1));
    expect(added[0]!.payer).toEqual({ kind: "name", name: "Abu Ali", phone: "03 111 222" });
  });
});

describe("Tabs on this game", () => {
  const view: BookingItemsPanelView = {
    bookerPersonId: "per_huda",
    bookerName: "Huda",
    tabsOwed: false,
    tabs: [
      {
        saleId: "s1",
        personId: "per_huda",
        name: "Huda",
        lines: [
          { id: "l1", name: "Cola", qty: 2, currency: "USD", unit: "1.50", total: "3.00" },
          { id: "l2", name: "Water", qty: 1, currency: "LBP", unit: "20000", total: "20000" },
        ],
        remainingLbp: "20000",
        remainingUsd: "3.00",
        paidUsd: "0.00",
      },
      { saleId: "s2", personId: null, name: "Abu Karim", lines: [{ id: "l3", name: "Cola", qty: 1, currency: "USD", unit: "1.50", total: "1.50" }], remainingLbp: "0", remainingUsd: "1.50", paidUsd: "0.00" },
    ],
  };
  const collected: Sent[] = [];
  const actions: ItemsActions = {
    submitAddBookingItems,
    submitWalkInSale: submitWalkInSale as never,
    submitCollectTab: async (input) => {
      collected.push(input as Sent);
      return { ok: true, changeLbp: "0", changeUsd: "0.00" };
    },
    submitRemoveBookingItem: async () => ({ ok: true }),
  };
  const list = () =>
    render(
      createElement(BookingItems, {
        ...actions,
        bookingId: "bk1",
        canAdd: true,
        mayRemove: true,
        mayCollect: true,
        products: PRODUCTS,
        view,
        lbpPerUsd: "89500",
        locale: "en",
      }),
    );

  it("is one row per tab: name, a short list of items, the total per currency and Collect", () => {
    list();
    expect(text(t("owner.itemsHeading"))).toBeTruthy();
    expect(screen.getAllByRole("button", { expanded: false })).toHaveLength(2);
    expect(document.body.textContent).toContain("Cola ×2");
    expect(document.body.textContent).toContain("Water ×1");
    const collects = screen.getAllByRole("button", { name: new RegExp(`^${t("owner.collect")}`) });
    expect(collects).toHaveLength(2);
    expect(collects[0]!.textContent).toContain("$3");
    expect(collects[0]!.textContent).toContain("20,000");
    expect(collects[1]!.textContent).toContain("$1.50");
    expect(screen.queryByText(t("owner.shop"))).toBeNull();
  });

  it("Collect takes exactly what the tab owes, in each currency", async () => {
    list();
    fireEvent.click(screen.getAllByRole("button", { name: new RegExp(`^${t("owner.collect")}`) })[0]!);
    await waitFor(() => expect(collected).toHaveLength(1));
    expect(collected[0]).toEqual({ saleId: "s1", usdAmount: "3.00", lbpAmount: "20000" });
  });
});
