import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { adjustBookingDue } from "@/modules/booking/application/adjust-booking-due";
import { cancelBooking } from "@/modules/booking/application/cancel-booking";
import { collectBookingPayment } from "@/modules/booking/application/collect-booking-payment";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { recordNoShow } from "@/modules/booking/application/record-no-show";
import { rejectBooking } from "@/modules/booking/application/reject-booking";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
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
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { assertMoneyInvariants } from "./invariants";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Audit §2.6 races R1–R4 and R9: every money-changing use case locks the booking row,
 * so each pair below runs one after the other. Ten real concurrent runs per pair.
 */
const TIME_ZONE = "Asia/Beirut";
const RUNS = 10;

let fixture: TestFixture;
let phoneSeq = 0;

describe("money races (booking row lock)", () => {
  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
  });

  afterAll(async () => {
    await truncateAll();
    await finishIntegrationFile();
  });

  it("R1: two whole-game collects on one booking take the cash once", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      const bookingId = await futureBooking(2 + i, 0);
      const results = await Promise.allSettled([
        collectBookingPayment({ bookingId, tenders: usd("30.00") }),
        collectBookingPayment({ bookingId, tenders: usd("30.00") }),
      ]);
      expect(outcomes(results).sort()).toEqual(["ok", "payment.nothing_due"]);
      const state = await moneyOf(bookingId);
      expect(state.payments).toBe(1);
      expect(state.collected.equals("30.00")).toBe(true);
      expect(state.due.gte(state.collected)).toBe(true);
    }
    await assertMoneyInvariants([]);
  }, 60_000);

  it("R2: an owner cancel racing a collect never leaves the due below collected", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      const bookingId = await futureBooking(2 + i, 1);
      const results = await Promise.allSettled([
        collectBookingPayment({ bookingId, tenders: usd("30.00") }),
        cancelBooking({ bookingId, initiator: "OWNER" }),
      ]);
      const [collect, cancel] = outcomes(results);
      expect(cancel).toBe("ok");
      // Cancel first: nothing is left to collect. Collect first: cancel keeps the cash.
      expect(["ok", "payment.nothing_due"]).toContain(collect);
      const state = await moneyOf(bookingId);
      expect(state.status).toBe("CANCELLED");
      expect(state.payments).toBeLessThanOrEqual(1);
      expect(state.due.gte(state.collected)).toBe(true);
    }
    await assertMoneyInvariants([]);
  }, 60_000);

  it("R3: adjust racing a collect either sees the payment or the payment sees the new due", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      const bookingId = await futureBooking(2 + i, 2);
      const results = await Promise.allSettled([
        adjustBookingDue({
          bookingId,
          toUsd: new Decimal("10.00"),
          reason: "DISCOUNT",
          note: null,
        }),
        collectBookingPayment({ bookingId, tenders: usd("30.00") }),
      ]);
      const [adjust, collect] = outcomes(results);
      expect(collect).toBe("ok");
      const state = await moneyOf(bookingId);
      expect(state.payments).toBe(1);
      if (adjust === "ok") {
        // Adjust ran first. The collect waited, read due 10.00 under the lock, and took
        // $30 as a knowing overpay (SPEC-06). Before the lock it recorded due 30.00.
        expect(state.due.equals("10.00")).toBe(true);
        expect(state.paymentDueSnapshots).toEqual(["10.00"]);
      } else {
        // Collect ran first. Adjust saw the $30 and refused to drop below it.
        expect(adjust).toBe("booking.due_below_collected");
        expect(state.due.equals("30.00")).toBe(true);
        expect(state.due.gte(state.collected)).toBe(true);
        expect(state.dueChanges).toBe(0);
      }
    }
    await assertMoneyInvariants([]);
  }, 60_000);

  it("R4: a waived no-show racing a collect never leaves the due below collected", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      const bookingId = await pastBooking(2 + i, 0);
      const results = await Promise.allSettled([
        recordNoShow({ bookingId, feeUsd: new Decimal("0.00") }),
        collectBookingPayment({ bookingId, tenders: usd("30.00") }),
      ]);
      const [noShow, collect] = outcomes(results);
      expect(noShow).toBe("ok");
      expect(["ok", "payment.nothing_due"]).toContain(collect);
      const state = await moneyOf(bookingId);
      expect(state.status).toBe("NO_SHOW");
      expect(state.payments).toBeLessThanOrEqual(1);
      expect(state.due.gte(state.collected)).toBe(true);
    }
    await assertMoneyInvariants([]);
  }, 60_000);

  it("R9: a split racing a whole-game collect never lets the whole payment in after the split", async () => {
    for (let i = 0; i < RUNS; i += 1) {
      const bookingId = await futureBooking(2 + i, 3);
      const results = await Promise.allSettled([
        switchToPerPlayer({ bookingId, count: 5 }),
        collectBookingPayment({ bookingId, tenders: usd("30.00") }),
      ]);
      const [split, collect] = outcomes(results);
      expect(split).toBe("ok");
      const state = await moneyOf(bookingId);
      expect(state.mode).toBe("PER_PLAYER");
      if (collect === "ok") {
        // Collect committed first; the split then saw it as Unassigned (spec §3.1).
        // Transaction ids prove the order: the payment was written before any slot row.
        // Without the lock the payment was written after the split (larger xmin).
        const [order] = await platformDb.$queryRaw<Array<{ paymentFirst: boolean }>>`
          SELECT (SELECT MAX(p.xmin::text::bigint) FROM "Payment" p WHERE p."sourceId" = ${bookingId})
            < (SELECT MIN(bp.xmin::text::bigint) FROM "BookingParticipant" bp
               WHERE bp."bookingId" = ${bookingId} AND NOT bp."isRequester") AS "paymentFirst"
        `;
        expect(order?.paymentFirst).toBe(true);
      } else {
        // Split committed first; the whole-game collect was refused.
        expect(collect).toBe("booking.collect_per_player");
        expect(state.payments).toBe(0);
      }
      expect(state.payments).toBeLessThanOrEqual(1);
      expect(state.due.gte(state.collected)).toBe(true);
    }
    await assertMoneyInvariants([]);
  }, 60_000);

  it("refuses to adjust the due of a PENDING or REJECTED request", async () => {
    const pendingId = await publicRequest(2, 4);
    const rejectedId = await publicRequest(3, 4);
    await rejectBooking(rejectedId);

    for (const bookingId of [pendingId, rejectedId]) {
      await expect(
        adjustBookingDue({
          bookingId,
          toUsd: new Decimal("1.00"),
          reason: "DISCOUNT",
          note: null,
        }),
      ).rejects.toMatchObject({ key: "booking.due_not_confirmed" });
      const state = await moneyOf(bookingId);
      expect(state.due.equals("30.00")).toBe(true);
      expect(state.dueChanges).toBe(0);
    }
  });
});

type Outcome = string;

function outcomes(results: PromiseSettledResult<unknown>[]): Outcome[] {
  return results.map((result) =>
    result.status === "fulfilled"
      ? "ok"
      : ((result.reason as { key?: string })?.key ?? String(result.reason)),
  );
}

function usd(amount: string) {
  return [{ currency: "USD" as const, amount: new Decimal(amount) }];
}

function nextPhone(): string {
  phoneSeq += 1;
  return `03${String(500000 + phoneSeq)}`;
}

async function slotOn(daysAhead: number, index: number) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const config = parseScheduleConfig(pitch.scheduleConfig);
  const day = addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead);
  const slot = generateSlotsForDay({ config, localDate: day, timeZone: TIME_ZONE, occupied: [] })[
    index
  ];
  if (!slot) throw new Error(`no slot ${index} on day offset ${daysAhead}`);
  return slot;
}

async function futureBooking(daysAhead: number, index: number): Promise<string> {
  const slot = await slotOn(daysAhead, index);
  const { bookingId } = await createOwnerBooking({
    pitchId: fixture.pitchId,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    name: "لاعب",
    phone: nextPhone(),
  });
  return bookingId;
}

async function publicRequest(daysAhead: number, index: number): Promise<string> {
  const slot = await slotOn(daysAhead, index);
  const { bookingId } = await requestPublicSlot({
    pitchId: fixture.pitchId,
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    name: "طالب",
    phone: nextPhone(),
  });
  return bookingId;
}

async function pastBooking(daysAgo: number, index: number): Promise<string> {
  const slot = await slotOn(-daysAgo, index);
  return db.$transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, { name: "جو", phone: nextPhone() });
    const id = await insertApprovedOwnerBooking(tx, {
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      priceUsd: new Decimal("30.00"),
    });
    await insertRequesterParticipant(tx, {
      bookingId: id,
      personId: person.id,
      amountDueUsd: new Decimal("30.00"),
    });
    return id;
  });
}

async function moneyOf(bookingId: string) {
  const booking = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
  const payments = await platformDb.payment.findMany({
    where: { sourceType: "BOOKING", sourceId: bookingId },
    include: { tenders: true },
  });
  const collected = payments
    .flatMap((payment) => payment.tenders)
    .reduce((sum, tender) => sum.plus(tender.usdEquivalent.toString()), new Decimal(0));
  return {
    status: booking.status,
    mode: booking.collectionMode,
    due: new Decimal(booking.amountDueUsd.toString()),
    collected,
    payments: payments.length,
    paymentDueSnapshots: payments.map((payment) =>
      new Decimal(payment.amountDueUsd.toString()).toFixed(2),
    ),
    dueChanges: await platformDb.bookingDueChange.count({ where: { bookingId } }),
  };
}
