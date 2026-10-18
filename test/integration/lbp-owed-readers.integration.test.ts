import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { lbpUpcomingView } from "@/app/owner/(app)/today/_components/lbp-row-view";
import { formatOwed } from "@/lib/format/money";
import { getPersonBookingStats } from "@/modules/booking/application/get-person-booking-stats";
import { listDebtWarnings } from "@/modules/booking/application/list-debt-warnings";
import { listOwed } from "@/modules/booking/application/list-owed";
import { listPersonBookings } from "@/modules/booking/application/list-person-bookings";
import { loadOwnerDay, sumOwedParts } from "@/modules/booking/application/load-owner-day";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { endedGame, nextPhone, slotOn } from "./shop-helpers";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 readers slice: a stadium with old USD games and new LBP games. Every screen and total that
 * shows what a game owes returns it per currency and never leaves an LBP game out. WRITTEN, NOT RUN
 * when authored (the task forbade running suites): treat every expectation as unverified until
 * `npm run test:integration` has been run.
 *
 * Nothing can collect on an LBP game yet, so its settlements are inserted directly.
 */
let fixture: TestFixture;
let usd: { bookingId: string; personId: string };
let lbp: { bookingId: string; personId: string };

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  await platformDb.tenant.update({
    where: { id: fixture.tenantId },
    data: { settings: { perPlayerSplitEnabled: true, gamePriceCurrency: "LBP" } },
  });
  clearReactCache();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
  // An old game in dollars (kept from before the switch) and a new, ended, unpaid game in pounds.
  usd = await endedGame(fixture, 3, "Ali", nextPhone());
  lbp = await endedLbpGame(2, "Lina", "2000000");
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

/** An APPROVED game priced in pounds that ended `daysAgo` days ago, booked for `name`. */
async function endedLbpGame(daysAgo: number, name: string, pounds: string) {
  const slot = await slotOn(fixture, -daysAgo);
  const person = await db.$transaction((tx) => findOrCreatePerson(tx, { name, phone: nextPhone() }));
  const bookingId = `bk_${randomUUID()}`;
  await platformDb.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source",
      "priceCurrency", "priceLbp", "amountDueLbp")
    VALUES (${bookingId}, ${fixture.tenantId}, ${fixture.pitchId}, tstzrange(${slot.start}, ${slot.end}, '[)'),
      'APPROVED'::"BookingStatus", 'OWNER'::"BookingSource", 'LBP'::"Currency", ${pounds}::decimal, ${pounds}::decimal)`;
  await platformDb.bookingParticipant.create({
    data: { tenantId: fixture.tenantId, bookingId, personId: person.id, isRequester: true, amountDueLbp: pounds },
  });
  return { bookingId, personId: person.id };
}

/** What the collecting slice will write for a payment: the pounds a payment settled on the game. */
async function settle(bookingId: string, lbpApplied: string) {
  await platformDb.bookingSettlement.create({
    data: { tenantId: fixture.tenantId, bookingId, paymentId: randomUUID(), lbpApplied },
  });
}

describe("an unpaid LBP game next to an old USD game", () => {
  it("the Owed page and the Money card total each currency apart, with the LBP game left in", async () => {
    const owed = await listOwed();
    expect([owed.totalUsd.toFixed(2), owed.totalLbp.toFixed(0), owed.games]).toEqual(["30.00", "2000000", 2]);
    const lina = owed.groups.find((group) => group.name === "Lina")!;
    expect([lina.totalUsd.toFixed(0), lina.totalLbp.toFixed(0)]).toEqual(["0", "2000000"]);
    expect([lina.debts[0]!.owedUsd.toFixed(0), lina.debts[0]!.owedLbp.toFixed(0)]).toEqual(["0", "2000000"]);
    const ali = owed.groups.find((group) => group.name === "Ali")!;
    expect([ali.totalUsd.toFixed(2), ali.totalLbp.toFixed(0)]).toEqual(["30.00", "0"]);
    expect(formatOwed({ usd: owed.totalUsd, lbp: owed.totalLbp }, "en")).toBe("2,000,000 LBP + $30");
    await assertMoneyInvariants([usd.personId, lbp.personId]);
  });

  it("shows 2,000,000 LBP owed; with 1,790,000 settled it shows 210,000 LBP", async () => {
    expect((await listOwed()).totalLbp.toFixed(0)).toBe("2000000");
    await settle(lbp.bookingId, "1790000");
    const owed = await listOwed();
    expect([owed.totalUsd.toFixed(2), owed.totalLbp.toFixed(0), owed.games]).toEqual(["30.00", "210000", 2]);
    await assertMoneyInvariants([usd.personId, lbp.personId]);
  });

  it("a game settled in full drops out of every owed reader", async () => {
    await settle(lbp.bookingId, "1000000");
    await settle(lbp.bookingId, "1000000");
    const owed = await listOwed();
    expect([owed.totalLbp.toFixed(0), owed.games]).toEqual(["0", 1]);
    expect((await loadOwnerDay(undefined)).toCollect.map((row) => row.id)).toEqual([usd.bookingId]);
    expect(await listDebtWarnings([lbp.personId])).toEqual([]);
  });

  it("Today's To collect lists both games, totals them per currency, and builds the pounds row", async () => {
    await settle(lbp.bookingId, "1790000");
    const day = await loadOwnerDay(undefined);
    expect(day.toCollect.map((row) => row.currency).sort()).toEqual(["LBP", "USD"]);
    const parts = sumOwedParts(day.toCollect);
    expect([parts.usd.toFixed(2), parts.lbp.toFixed(0)]).toEqual(["30.00", "210000"]);

    const game = day.toCollect.find((row) => row.id === lbp.bookingId)!;
    if (game.currency !== "LBP") throw new Error("expected an LBP game");
    expect([game.settledLbp.toFixed(0), game.remainingLbp.toFixed(0), game.owedLbp.toFixed(0)]).toEqual(["1790000", "210000", "210000"]);
    const view = lbpUpcomingView(game, {
      items: undefined,
      itemsPanel: { tabsOwed: true, bookerPersonId: game.requesterPersonId, bookerName: game.requesterName, tabs: [] },
      now: new Date(),
      locale: "en",
      hourCycle: "h23",
      openWaitlist: [],
      stadiumName: "Test Stadium",
      showPitch: false,
      dayStartHour: 6,
      extendedMinutes: 0,
      series: undefined,
      splitEnabled: false,
    });
    expect(view.lbp).toEqual({ due: "210,000 LBP", paid: "1,790,000 LBP", settled: false, pill: "210,000 LBP", remaining: "210000" });
  });

  it("the person page: games, stats and the debt warning on the Requests tab are in pounds", async () => {
    const before = await getPersonBookingStats(lbp.personId);
    expect([before.owesNowLbp.toFixed(0), before.owesNowUsd.toFixed(0), before.totalPaidLbp.toFixed(0), before.gamesPlayed]).toEqual(["2000000", "0", "0", 1]);
    await settle(lbp.bookingId, "1790000");
    const stats = await getPersonBookingStats(lbp.personId);
    expect([stats.owesNowLbp.toFixed(0), stats.totalPaidLbp.toFixed(0)]).toEqual(["210000", "1790000"]);

    const { rows } = await listPersonBookings(lbp.personId, null);
    expect(rows.map((row) => [row.amountDue.currency, row.collected.amount.toFixed(0)])).toEqual([["LBP", "1790000"]]);

    const [warning] = await listDebtWarnings([lbp.personId]);
    expect([warning!.totalLbp.toFixed(0), warning!.totalUsd.toFixed(0)]).toEqual(["210000", "0"]);
    expect(formatOwed({ usd: warning!.totalUsd, lbp: warning!.totalLbp }, "ar")).toBe("210,000 ل.ل");

    const aliStats = await getPersonBookingStats(usd.personId);
    expect([aliStats.owesNowUsd.toFixed(0), aliStats.owesNowLbp.toFixed(0)]).toEqual(["30", "0"]);
    await assertMoneyInvariants([usd.personId, lbp.personId]);
  });

  it("one person with a game in each currency has both warnings side by side", async () => {
    const slot = await slotOn(fixture, -4);
    const bookingId = `bk_${randomUUID()}`;
    await platformDb.$executeRaw`
      INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source",
        "priceCurrency", "priceUsd", "amountDueUsd")
      VALUES (${bookingId}, ${fixture.tenantId}, ${fixture.pitchId}, tstzrange(${slot.start}, ${slot.end}, '[)'),
        'APPROVED'::"BookingStatus", 'OWNER'::"BookingSource", 'USD'::"Currency", 25.00, 25.00)`;
    await platformDb.bookingParticipant.create({
      data: { tenantId: fixture.tenantId, bookingId, personId: lbp.personId, isRequester: true, amountDueUsd: "25.00" },
    });
    const [warning] = await listDebtWarnings([lbp.personId]);
    expect([warning!.totalUsd.toFixed(2), warning!.totalLbp.toFixed(0)]).toEqual(["25.00", "2000000"]);
    expect(formatOwed({ usd: warning!.totalUsd, lbp: warning!.totalLbp }, "en")).toBe("2,000,000 LBP + $25");
  });
});
