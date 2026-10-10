import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { collectSlotPayment } from "@/modules/booking/application/collect-player-payment";
import { listOwed } from "@/modules/booking/application/list-owed";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { switchToPerPlayer } from "@/modules/booking/application/switch-collection-mode";
import {
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { createStaffSession, seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Money > Owed to you: the existing owed rules (classifyDue, personOwedOnBooking) over every
 * booking with money due, grouped by person in one query. It must agree with Today.
 */
let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  clearRequestStubs();
  fixture = await seedMinimalFixture();
  actAs(fixture.sessionId);
});

function actAs(token: string, slug = fixture.tenantSlug) {
  clearRequestStubs();
  setTenantSlug(slug);
  setSessionCookie(token);
}

/** An approved $30 game that ended `daysAgo` days ago, booked for `name`. */
async function endedGame(daysAgo: number, name: string, phone: string): Promise<string> {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const day = addCalendarDays(civilDateInTimeZone(new Date(), "Asia/Beirut"), -daysAgo);
  const slot = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: day,
    timeZone: "Asia/Beirut",
    occupied: [],
  })[0]!;
  return db.$transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, { name, phone });
    const id = await insertApprovedOwnerBooking(tx, {
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      priceUsd: new Decimal("30.00"),
    });
    await insertRequesterParticipant(tx, { bookingId: id, personId: person.id, amountDueUsd: new Decimal("30.00") });
    return id;
  });
}

async function scenario() {
  const a = await endedGame(2, "Ali", "03111111"); // Ali owes 30
  const b = await endedGame(3, "Ali", "03111111"); // Ali paid 10, owes 20
  await collectBookingPayment({ bookingId: b, tenders: [{ currency: "USD", amount: new Decimal("10.00") }] });
  const c = await endedGame(1, "Sara", "03222222"); // split three ways, nobody paid
  await switchToPerPlayer({ bookingId: c, count: 3 });
  return { a, b, c };
}

describe("listOwed", () => {
  it("groups by person, with per-player slots and the unnamed slots in one group", async () => {
    await scenario();
    const owed = await listOwed();

    expect(owed.groups.map((group) => [group.name, group.totalUsd.toFixed(2), group.games])).toEqual([
      ["Sara", "10.00", 1], // newest debt first: her game ended yesterday
      [null, "20.00", 1], // two unnamed slots of the same game
      ["Ali", "50.00", 2],
    ]);
    expect(owed.groups.find((group) => group.name === null)?.debts).toHaveLength(2);
    const ali = owed.groups.find((group) => group.name === "Ali")!;
    expect(ali.debts.map((debt) => debt.owedUsd.toFixed(2))).toEqual(["30.00", "20.00"]); // newest first
  });

  it("the total equals the sum of the owed debts and matches Today's To collect", async () => {
    await scenario();
    const owed = await listOwed();
    const fromGroups = owed.groups.reduce((sum, group) => sum.plus(group.totalUsd), new Decimal(0));
    const fromDebts = owed.groups.flatMap((group) => group.debts).reduce((sum, debt) => sum.plus(debt.owedUsd), new Decimal(0));
    expect(owed.totalUsd.toFixed(2)).toBe("80.00");
    expect(fromGroups.toFixed(2)).toBe("80.00");
    expect(fromDebts.toFixed(2)).toBe("80.00");

    const today = await loadOwnerDay(undefined);
    const toCollect = today.toCollect.reduce((sum, row) => sum.plus(row.remaining), new Decimal(0));
    expect(toCollect.toFixed(2)).toBe(owed.totalUsd.toFixed(2));
    expect(today.toCollect).toHaveLength(owed.games);
  });

  it("follows a payment: a settled slot leaves the list and the total drops", async () => {
    const { c } = await scenario();
    const slots = await platformDb.bookingParticipant.findMany({ where: { bookingId: c, slotNumber: { not: null } }, orderBy: { slotNumber: "asc" } });
    await collectSlotPayment({ bookingId: c, participantId: slots[1]!.id });
    const owed = await listOwed();
    expect(owed.totalUsd.toFixed(2)).toBe("70.00");
    expect(owed.groups.find((group) => group.name === null)?.totalUsd.toFixed(2)).toBe("10.00");
  });

  it("counts a no-show fee as owed, and ignores games that have not ended", async () => {
    const noShow = await endedGame(1, "Omar", "03333333");
    await recordNoShow({ bookingId: noShow });
    const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
    const future = generateSlotsForDay({
      config: parseScheduleConfig(pitch.scheduleConfig),
      localDate: addCalendarDays(civilDateInTimeZone(new Date(), "Asia/Beirut"), 3),
      timeZone: "Asia/Beirut",
      occupied: [],
    })[0]!;
    await db.$transaction(async (tx) => {
      const person = await findOrCreatePerson(tx, { name: "Later", phone: "03444444" });
      const id = await insertApprovedOwnerBooking(tx, { pitchId: fixture.pitchId, start: future.start, end: future.end, priceUsd: new Decimal("30.00") });
      await insertRequesterParticipant(tx, { bookingId: id, personId: person.id, amountDueUsd: new Decimal("30.00") });
    });
    const owed = await listOwed();
    expect(owed.groups.map((group) => group.name)).toEqual(["Omar"]);
    expect(owed.totalUsd.toFixed(2)).toBe("30.00");
  });

  it("is empty when nobody owes anything", async () => {
    const owed = await listOwed();
    expect(owed).toMatchObject({ games: 0, groups: [] });
    expect(owed.totalUsd.toFixed(2)).toBe("0.00");
  });

  it("never includes another stadium's debts", async () => {
    const other = await seedMinimalFixture({ tenantSlug: "sami", tenantName: "Sami", ownerIdentifier: "owner@sami" });
    actAs(other.sessionId, "sami");
    // A debt in Sami's stadium, made through its own pitch.
    const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: other.pitchId } });
    const slot = generateSlotsForDay({
      config: parseScheduleConfig(pitch.scheduleConfig),
      localDate: addCalendarDays(civilDateInTimeZone(new Date(), "Asia/Beirut"), -2),
      timeZone: "Asia/Beirut",
      occupied: [],
    })[0]!;
    await db.$transaction(async (tx) => {
      const person = await findOrCreatePerson(tx, { name: "Other", phone: "03555555" });
      const id = await insertApprovedOwnerBooking(tx, { pitchId: other.pitchId, start: slot.start, end: slot.end, priceUsd: new Decimal("99.00") });
      await insertRequesterParticipant(tx, { bookingId: id, personId: person.id, amountDueUsd: new Decimal("99.00") });
    });
    expect((await listOwed()).totalUsd.toFixed(2)).toBe("99.00");

    actAs(fixture.sessionId);
    expect((await listOwed()).groups).toEqual([]);
  });

  it("needs reports.view", async () => {
    await scenario();
    actAs(await createStaffSession(fixture.tenantId, { "payments.collect": true }));
    await expect(listOwed()).rejects.toMatchObject({ key: "access.not_allowed" });
    actAs(await createStaffSession(fixture.tenantId, { "reports.view": true }));
    expect((await listOwed()).games).toBe(3);
  });
});
