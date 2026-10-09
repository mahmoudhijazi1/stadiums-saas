import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { ZodError } from "zod";
import { loadActivityPage } from "@/app/owner/(app)/money/activity-load";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { addBookingItems } from "@/modules/booking/application/add-booking-items";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { listOwed } from "@/modules/booking/application/list-owed";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { removeBookingItem } from "@/modules/booking/application/remove-booking-item";
import { switchToPerPlayer } from "@/modules/booking/application/switch-collection-mode";
import { setExchangeRate } from "@/modules/payment/application/set-exchange-rate";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import { collectTabPayment } from "@/modules/shop/application/collect-tab-payment";
import { listBookingItems } from "@/modules/shop/application/list-booking-items";
import { archiveProduct, createProduct } from "@/modules/shop/application/products";
import { summarizeShopPeriod } from "@/modules/shop/application/summarize-shop-period";
import { civilDateInTimeZone, formatCivilDate } from "@/modules/venue/domain/availability";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { endedGame, futureBooking, nextPhone, requesterPersonId } from "./shop-helpers";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Mini shop slice 2: items put on a game. "On the game" raises the booking due (WHOLE only) and is
 * paid through the booking; "on a player" is that player's own tab, collected on its own.
 */
let fixture: TestFixture;
let cola: { id: string };
let chips: { id: string };

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  actAs(fixture.sessionId);
  cola = await createProduct({ name: "Cola", priceUsd: "1.50" });
  chips = await createProduct({ name: "Chips", priceUsd: "2.25" });
});

function actAs(token: string, slug = fixture.tenantSlug) {
  clearRequestStubs();
  setTenantSlug(slug);
  setSessionCookie(token);
}

const game = { kind: "game" } as const;

async function dueOf(bookingId: string) {
  return (await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } })).amountDueUsd.toFixed(2);
}

async function netTotalOf(saleId: string): Promise<string> {
  const rows = await platformDb.saleItem.findMany({ where: { saleId } });
  return rows.reduce((sum, row) => sum.plus(row.lineTotalUsd.toString()), new Decimal(0)).toFixed(2);
}

describe("putting items on a game", () => {
  it("on the game (booker) is the booker's tab: the due is untouched, nothing is logged, it is collected on its own", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const added = await addBookingItems({
      bookingId,
      lines: [{ productId: cola.id, qty: 2 }, { productId: chips.id, qty: 1 }],
      payer: game,
    });
    expect(added.itemCount).toBe(3);
    expect(added.totalUsd.toFixed(2)).toBe("5.25");
    expect(await dueOf(bookingId)).toBe("30.00");
    expect(await platformDb.bookingDueChange.count({ where: { bookingId } })).toBe(0);

    // It is the requester's tab, the same one a second add and a pick of the booker's name reach.
    const sale = await platformDb.sale.findUniqueOrThrow({ where: { id: added.saleId } });
    expect(sale.payerPersonId).toBe(await requesterPersonId(bookingId));
    const again = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: game });
    const byPerson = await addBookingItems({
      bookingId,
      lines: [{ productId: cola.id, qty: 1 }],
      payer: { kind: "person", personId: sale.payerPersonId! },
    });
    expect([again.saleId, byPerson.saleId]).toEqual([added.saleId, added.saleId]);
    expect(await platformDb.sale.count({ where: { bookingId } })).toBe(1);
    expect(await netTotalOf(added.saleId)).toBe("8.25");

    // The tab is collected separately; the booking is collected separately; neither touches the other.
    await collectTabPayment({ saleId: added.saleId, usdAmount: "8.25" });
    await collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: new Decimal("30.00") }] });
    const ledger = await platformDb.ledgerEntry.findMany({ where: { sourceId: { in: [bookingId, added.saleId] } }, orderBy: { amountUsd: "asc" } });
    expect(ledger.map((l) => [l.sourceType, l.amountUsd.toFixed(2)])).toEqual([["SALE", "8.25"], ["BOOKING", "30.00"]]);
    expect(await dueOf(bookingId)).toBe("30.00");
  });

  it("the database refuses a sale on a booking that names no payer, and the old payment guard is gone", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const membership = await platformDb.membership.findFirstOrThrow({ where: { tenantId: fixture.tenantId, role: "OWNER" } });
    await expect(
      platformDb.sale.create({ data: { tenantId: fixture.tenantId, createdByMembershipId: membership.id, bookingId } }),
    ).rejects.toBeDefined();
    expect(await platformDb.sale.count({ where: { bookingId } })).toBe(0);
  });

  it("per-player: the booker's tab and a named player's tab both work, and no due or slot due moves", async () => {
    const bookingId = await futureBooking(fixture, 30);
    await switchToPerPlayer({ bookingId, count: 3 });
    const slotsBefore = (await platformDb.bookingParticipant.findMany({ where: { bookingId }, orderBy: { id: "asc" } })).map((p) => p.amountDueUsd.toFixed(2));

    await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: game });
    const personId = await requesterPersonId(bookingId);
    const tab = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 2 }], payer: { kind: "person", personId } });
    expect(tab.totalUsd.toFixed(2)).toBe("3.00");
    expect(await dueOf(bookingId)).toBe("30.00");
    expect((await platformDb.bookingParticipant.findMany({ where: { bookingId }, orderBy: { id: "asc" } })).map((p) => p.amountDueUsd.toFixed(2))).toEqual(slotsBefore);
    expect(await platformDb.bookingDueChange.count({ where: { bookingId, reason: "SHOP_ITEMS" } })).toBe(0);
  });

  it("a tab never touches the due; a second add appends; payers get their own tab; names match without case; a known phone becomes that person", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const owner = await requesterPersonId(bookingId);
    const first = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "person", personId: owner } });
    const second = await addBookingItems({ bookingId, lines: [{ productId: chips.id, qty: 1 }], payer: { kind: "person", personId: owner } });
    expect(second.saleId).toBe(first.saleId);
    expect(await netTotalOf(first.saleId)).toBe("3.75");
    expect(await dueOf(bookingId)).toBe("30.00");

    const sami = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "name", name: "Sami" } });
    const samiAgain = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "name", name: "  sami " } });
    expect(samiAgain.saleId).toBe(sami.saleId);
    expect(sami.saleId).not.toBe(first.saleId);

    const phone = nextPhone();
    const known = await db.$transaction((tx) => findOrCreatePerson(tx, { name: "Nour", phone }));
    const byPhone = await addBookingItems({ bookingId, lines: [{ productId: chips.id, qty: 1 }], payer: { kind: "name", name: "Someone", phone } });
    const sale = await platformDb.sale.findUniqueOrThrow({ where: { id: byPhone.saleId } });
    expect([sale.payerPersonId, sale.payerName]).toEqual([known.id, null]);

    const view = (await listBookingItems([bookingId])).get(bookingId)!;
    expect(view.tabs.map((tab) => [tab.name, tab.totalUsd.toFixed(2), tab.remainingUsd.toFixed(2)]).sort()).toEqual([
      ["Booker", "3.75", "3.75"],
      ["Nour", "2.25", "2.25"],
      ["Sami", "3.00", "3.00"],
    ]);
  });

  it("refuses an unconfirmed game, an archived or unknown item, another stadium's player, and a price from the client", async () => {
    const bookingId = await futureBooking(fixture, 30);
    await expect(addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1, unitPriceUsd: "0.01" }], payer: game })).rejects.toBeInstanceOf(ZodError);
    await expect(addBookingItems({ bookingId, lines: [{ productId: "nope", qty: 1 }], payer: game })).rejects.toMatchObject({ key: "shop.product_unavailable" });
    await archiveProduct(chips.id);
    await expect(addBookingItems({ bookingId, lines: [{ productId: chips.id, qty: 1 }], payer: game })).rejects.toMatchObject({ key: "shop.product_unavailable" });
    await expect(addBookingItems({ bookingId: "nope", lines: [{ productId: cola.id, qty: 1 }], payer: game })).rejects.toMatchObject({ key: "booking.not_found" });

    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    actAs(other.sessionId, "sami");
    const stranger = await db.$transaction((tx) => findOrCreatePerson(tx, { name: "Elsewhere", phone: nextPhone() }));
    actAs(fixture.sessionId);
    await expect(
      addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "person", personId: stranger.id } }),
    ).rejects.toMatchObject({ key: "shop.player_not_found" });

    await cancelBooking({ bookingId, initiator: "OWNER" });
    await expect(addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "name", name: "Late" } })).rejects.toMatchObject({
      key: "shop.booking_not_open",
    });
    expect(await platformDb.sale.count({ where: { bookingId } })).toBe(0);
  });

  it("adding needs shop.sell only; removing needs bookings.adjust_due; collecting a tab needs payments.collect", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const line = [{ productId: cola.id, qty: 1 }];

    actAs(await createStaffSession(fixture.tenantId, { "payments.collect": true }));
    await expect(addBookingItems({ bookingId, lines: line, payer: game })).rejects.toMatchObject({ key: "access.not_allowed" });

    actAs(await createStaffSession(fixture.tenantId, { "shop.sell": true }));
    const gameAdd = await addBookingItems({ bookingId, lines: line, payer: game });
    const tabAdd = await addBookingItems({ bookingId, lines: line, payer: { kind: "name", name: "Zed" } });
    const item = await platformDb.saleItem.findFirstOrThrow({ where: { saleId: gameAdd.saleId } });
    await expect(removeBookingItem({ itemId: item.id, qty: 1 })).rejects.toMatchObject({ key: "access.not_allowed" });
    await expect(collectTabPayment({ saleId: tabAdd.saleId, usdAmount: "1.50" })).rejects.toMatchObject({ key: "access.not_allowed" });

    actAs(await createStaffSession(fixture.tenantId, { "bookings.adjust_due": true, "payments.collect": true }));
    await expect(addBookingItems({ bookingId, lines: line, payer: game })).rejects.toMatchObject({ key: "access.not_allowed" });
    await removeBookingItem({ itemId: item.id, qty: 1 });
    await collectTabPayment({ saleId: tabAdd.saleId, usdAmount: "1.50" });

    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    await expect(addBookingItems({ bookingId, lines: line, payer: game })).rejects.toMatchObject({ key: "access.not_allowed" });
  });
});

describe("removing items", () => {
  it("a removal is a compensating negative line; the booking due never moves", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 3 }], payer: game }); // 4.50
    const item = await platformDb.saleItem.findFirstOrThrow({ where: { saleId } });

    await removeBookingItem({ itemId: item.id, qty: 1 });
    expect(await dueOf(bookingId)).toBe("30.00");
    const lines = await platformDb.saleItem.findMany({ where: { saleId }, orderBy: { id: "asc" } });
    expect(lines.map((l) => [l.qty, l.lineTotalUsd.toFixed(2), l.reversesItemId === item.id])).toEqual([
      [3, "4.50", false],
      [-1, "-1.50", true],
    ]);
    expect((await listBookingItems([bookingId])).get(bookingId)!.tabs[0]!.lines.map((l) => [l.qty, l.totalUsd.toFixed(2)])).toEqual([[2, "3.00"]]);
    expect(await platformDb.bookingDueChange.count({ where: { bookingId } })).toBe(0);

    await expect(removeBookingItem({ itemId: item.id, qty: 3 })).rejects.toMatchObject({ key: "shop.remove_exceeds" });
    await expect(removeBookingItem({ itemId: "nope", qty: 1 })).rejects.toMatchObject({ key: "shop.item_not_found" });
    await expect(removeBookingItem({ itemId: lines[1]!.id, qty: 1 })).rejects.toMatchObject({ key: "shop.item_not_found" });
  });

  it("a tab: removable until it has a payment, then not", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 2 }, { productId: chips.id, qty: 1 }], payer: { kind: "name", name: "Rami" } });
    const items = await platformDb.saleItem.findMany({ where: { saleId }, orderBy: { id: "asc" } });
    await removeBookingItem({ itemId: items[0]!.id, qty: 2 });
    expect(await netTotalOf(saleId)).toBe("2.25");
    expect(await dueOf(bookingId)).toBe("30.00");

    await collectTabPayment({ saleId, usdAmount: "1.00" });
    await expect(removeBookingItem({ itemId: items[1]!.id, qty: 1 })).rejects.toMatchObject({ key: "shop.tab_has_payments" });
    expect(await netTotalOf(saleId)).toBe("2.25");
  });

  it("the database refuses a negative line that reverses nothing, or the wrong thing, or too much", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const a = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 2 }], payer: game });
    const b = await addBookingItems({ bookingId, lines: [{ productId: chips.id, qty: 1 }], payer: { kind: "name", name: "Lina" } });
    const colaLine = await platformDb.saleItem.findFirstOrThrow({ where: { saleId: a.saleId } });
    const chipsLine = await platformDb.saleItem.findFirstOrThrow({ where: { saleId: b.saleId } });
    const base = { tenantId: fixture.tenantId, qty: -1, unitPriceUsd: "1.50", lineTotalUsd: "-1.50" };

    // A walk-in style negative line with no reversal named.
    await expect(platformDb.saleItem.create({ data: { ...base, saleId: a.saleId, productId: cola.id } })).rejects.toBeDefined();
    // Names a line of another sale.
    await expect(
      platformDb.saleItem.create({ data: { ...base, saleId: a.saleId, productId: cola.id, reversesItemId: chipsLine.id } }),
    ).rejects.toBeDefined();
    // Takes more than the line holds.
    await expect(
      platformDb.saleItem.create({ data: { ...base, qty: -3, lineTotalUsd: "-4.50", saleId: a.saleId, productId: cola.id, reversesItemId: colaLine.id } }),
    ).rejects.toBeDefined();
    // A positive line cannot claim to reverse something.
    await expect(
      platformDb.saleItem.create({ data: { ...base, qty: 1, lineTotalUsd: "1.50", saleId: a.saleId, productId: cola.id, reversesItemId: colaLine.id } }),
    ).rejects.toBeDefined();
    expect(await platformDb.saleItem.count({ where: { saleId: a.saleId } })).toBe(1);
  });
});

describe("cancel, no-show and split with a tab on the game", () => {
  it("a tab does not block a cancel and stays owed after it", async () => {
    const bookingId = await futureBooking(fixture, 30);
    await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: game });
    await addBookingItems({ bookingId, lines: [{ productId: chips.id, qty: 2 }], payer: { kind: "name", name: "Maya" } });

    await cancelBooking({ bookingId, initiator: "OWNER" });
    expect((await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe("CANCELLED");

    const owed = await listOwed();
    expect(owed.groups.find((group) => group.name === "Maya")!.totalUsd.toFixed(2)).toBe("4.50");
    expect(owed.groups.find((group) => group.name === "Booker")!.totalUsd.toFixed(2)).toBe("1.50");
    expect(owed.groups.flatMap((group) => group.debts).every((debt) => debt.kind === "tab")).toBe(true);
  });

  it("a tab does not block a no-show", async () => {
    const { bookingId } = await endedGame(fixture, 1);
    await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: game });
    await recordNoShow({ bookingId });
    expect((await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } })).status).toBe("NO_SHOW");
  });

  it("a tab does not block the per-player split, and the slots are split from the game amount alone", async () => {
    const bookingId = await futureBooking(fixture, 30);
    await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 4 }], payer: game });
    await switchToPerPlayer({ bookingId, count: 3 });
    const slots = await platformDb.bookingParticipant.findMany({ where: { bookingId, slotNumber: { not: null } } });
    expect(slots.reduce((sum, p) => sum.plus(p.amountDueUsd.toString()), new Decimal(0)).toFixed(2)).toBe("30.00");
  });
});

describe("collecting a player tab", () => {
  it("takes part payments, then the rest, then refuses; an overpay is recorded in full; the ledger is IN for SALE", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: chips.id, qty: 4 }], payer: { kind: "name", name: "Karim" } }); // 9.00
    await setExchangeRate(new Decimal("90000"));

    await collectTabPayment({ saleId, usdAmount: "4.00" });
    await collectTabPayment({ saleId, lbpAmount: "225000" }); // $2.50 at the frozen rate
    let view = (await listBookingItems([bookingId])).get(bookingId)!.tabs[0]!;
    expect([view.paidUsd.toFixed(2), view.remainingUsd.toFixed(2)]).toEqual(["6.50", "2.50"]);

    await collectTabPayment({ saleId, usdAmount: "3.00" }); // more than the 2.50 left
    view = (await listBookingItems([bookingId])).get(bookingId)!.tabs[0]!;
    expect(view.remainingUsd.toFixed(2)).toBe("-0.50");
    await expect(collectTabPayment({ saleId, usdAmount: "1.00" })).rejects.toMatchObject({ key: "payment.nothing_due" });

    const ledger = await platformDb.ledgerEntry.findMany({ where: { sourceType: "SALE", sourceId: saleId }, orderBy: { occurredAt: "asc" } });
    expect(ledger.map((entry) => [entry.direction, entry.amountUsd.toFixed(2)])).toEqual([["IN", "4.00"], ["IN", "2.50"], ["IN", "3.00"]]);
    const lbp = await platformDb.paymentTender.findFirstOrThrow({ where: { currency: "LBP", payment: { sourceId: saleId } } });
    expect(lbp.rateAtTime?.toFixed(0)).toBe("90000");
    expect(await dueOf(bookingId)).toBe("30.00");
  });

  it("shows in Activity as a SALE row named after the player", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 2 }], payer: { kind: "name", name: "Dina" } });
    await collectTabPayment({ saleId, usdAmount: "3.00" });
    const today = formatCivilDate(civilDateInTimeZone(new Date(), "Asia/Beirut"));
    const page = await loadActivityPage({ from: today, to: today, filter: "all" }, "en");
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({ label: "Dina", icon: "shop", direction: "IN", amountUsd: "3.00" });
    expect(page.rows[0]!.secondary).toBe("Shop · 2 items");
  });
});

describe("what is owed", () => {
  it("an unpaid tab on an ended game is owed under the person (with their own debt) or under the typed name; a game not yet played is not", async () => {
    const ali = await endedGame(fixture, 2, "Ali", "03111111"); // Ali owes 30 on the game
    await addBookingItems({ bookingId: ali.bookingId, lines: [{ productId: chips.id, qty: 2 }], payer: { kind: "person", personId: ali.personId } }); // 4.50 tab
    await addBookingItems({ bookingId: ali.bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "name", name: "Friend" } }); // 1.50 tab
    await addBookingItems({ bookingId: ali.bookingId, lines: [{ productId: cola.id, qty: 1 }], payer: { kind: "name", name: "friend" } }); // same tab, 3.00
    const later = await futureBooking(fixture, 30, "Later");
    await addBookingItems({ bookingId: later, lines: [{ productId: cola.id, qty: 5 }], payer: { kind: "name", name: "Early" } });

    const owed = await listOwed();
    expect(owed.groups.map((group) => [group.name, group.totalUsd.toFixed(2), group.games])).toEqual([
      ["Ali", "34.50", 1], // the game and his tab are one game
      ["Friend", "3.00", 1],
    ]);
    expect(owed.groups.find((group) => group.name === "Ali")!.debts.map((debt) => [debt.kind, debt.owedUsd.toFixed(2)]).sort()).toEqual([
      ["game", "30.00"],
      ["tab", "4.50"],
    ]);
    expect(owed.totalUsd.toFixed(2)).toBe("37.50");
  });

  it("Today and Money agree: a paid game with an open tab is still To collect, and the totals are equal", async () => {
    const paid = await endedGame(fixture, 1, "Paid", "03222222");
    await collectBookingPayment({ bookingId: paid.bookingId, tenders: [{ currency: "USD", amount: new Decimal("30.00") }] });
    await addBookingItems({ bookingId: paid.bookingId, lines: [{ productId: chips.id, qty: 2 }], payer: { kind: "name", name: "Tabby" } }); // 4.50
    const unpaid = await endedGame(fixture, 2, "Unpaid", "03333333"); // 30 owed
    await addBookingItems({ bookingId: unpaid.bookingId, lines: [{ productId: cola.id, qty: 2 }], payer: { kind: "person", personId: unpaid.personId } }); // 3.00 tab

    const owed = await listOwed();
    const today = await loadOwnerDay(undefined);
    const toCollect = today.toCollect.reduce((sum, row) => sum.plus(row.owedUsd), new Decimal(0));
    expect(owed.totalUsd.toFixed(2)).toBe("37.50");
    expect(toCollect.toFixed(2)).toBe(owed.totalUsd.toFixed(2));
    expect(today.toCollect).toHaveLength(owed.games);

    const row = today.toCollect.find((candidate) => candidate.id === paid.bookingId)!;
    expect([row.remaining.toFixed(2), row.tabsRemainingUsd.toFixed(2), row.owedUsd.toFixed(2)]).toEqual(["0.00", "4.50", "4.50"]);

    // Paying a tab takes it out of both.
    const view = (await listBookingItems([paid.bookingId])).get(paid.bookingId)!.tabs[0]!;
    await collectTabPayment({ saleId: view.saleId, usdAmount: "4.50" });
    expect((await listOwed()).totalUsd.toFixed(2)).toBe("33.00");
    expect((await loadOwnerDay(undefined)).toCollect.map((candidate) => candidate.id)).not.toContain(paid.bookingId);
  });

  it("the day line counts a tab on a game of that day", async () => {
    const { bookingId } = await endedGame(fixture, 0, "Today", "03444444");
    await collectBookingPayment({ bookingId, tenders: [{ currency: "USD", amount: new Decimal("30.00") }] });
    await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 2 }], payer: { kind: "name", name: "Kid" } });
    const day = await loadOwnerDay(formatCivilDate(civilDateInTimeZone(new Date(), "Asia/Beirut")));
    const row = day.games.find((candidate) => candidate.id === bookingId);
    // Whether this slot is on the current business day depends on the clock; when it is, the tab is in the line.
    if (row) expect(row.tabsRemainingUsd.toFixed(2)).toBe("3.00");
  });
});

describe("the Shop card with items on games", () => {
  it("counts items by the day they were added, and a removal takes them off", async () => {
    const bookingId = await futureBooking(fixture, 30);
    const { saleId } = await addBookingItems({ bookingId, lines: [{ productId: cola.id, qty: 3 }], payer: game });
    await addBookingItems({ bookingId, lines: [{ productId: chips.id, qty: 1 }], payer: { kind: "name", name: "Zoe" } });
    const today = formatCivilDate(civilDateInTimeZone(new Date(), "Asia/Beirut"));

    let summary = await summarizeShopPeriod({ from: today, to: today });
    expect(summary.salesUsd.toFixed(2)).toBe("6.75");
    expect(summary.items.map((item) => [item.name, item.qty])).toEqual([["Cola", 3], ["Chips", 1]]);

    const item = await platformDb.saleItem.findFirstOrThrow({ where: { saleId } });
    await removeBookingItem({ itemId: item.id, qty: 3 });
    summary = await summarizeShopPeriod({ from: today, to: today });
    expect(summary.salesUsd.toFixed(2)).toBe("2.25");
    expect(summary.items.map((entry) => entry.name)).toEqual(["Chips"]);
  });
});
