import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import pg from "pg";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { getCurrentTenant } from "@/lib/tenant-context";
import { getCurrentMembership } from "@/modules/access/application/get-current-membership";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { listOpenWaitlist } from "@/modules/booking/application/list-open-waitlist";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { loadFreeStrip, type FreeStrip } from "@/modules/booking/application/load-free-strip";
import { loadOwnerDay } from "@/modules/booking/application/load-owner-day";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import {
  insertApprovedOwnerBooking,
  insertRequesterParticipant,
} from "@/modules/booking/infrastructure/bookings";
import { findOrCreatePerson } from "@/modules/people/application/find-or-create-person";
import {
  addCalendarDays,
  civilDateInTimeZone,
  formatCivilDate,
  localTimeToUtc,
  type CivilDate,
} from "@/modules/venue/domain/availability";
import {
  CLOSED_WEEK_SCHEDULE,
  parseScheduleConfig,
  type Weekday,
} from "@/modules/venue/schemas/schedule-config";
import { FreeStrip as FreeStripView } from "@/app/owner/(app)/today/free-strip";
import { createStaffSession, seedMinimalFixture, seedTwoTenants } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { clearReactCache } from "./setup-mocks";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Today's free-slot strip. Fixture hours: 16:00 to 22:00, 60-minute slots, $30 default,
 * so a day offers 16, 17, 18, 19, 20 and 21.
 */
const TZ = "Asia/Beirut";
const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const ALL_HOURS = [16, 17, 18, 19, 20, 21];

let fixture: Awaited<ReturnType<typeof seedMinimalFixture>>;
let phoneSeq = 0;

function nextPhone(): string {
  phoneSeq += 1;
  return `03${String(700000 + phoneSeq)}`;
}

function inDays(n: number): CivilDate {
  return addCalendarDays(civilDateInTimeZone(new Date(), TZ), n);
}

function at(day: CivilDate, hour: number): Date {
  return localTimeToUtc(day, hour, 0, TZ);
}

function slotArgs(day: CivilDate, hour: number) {
  const start = at(day, hour);
  return {
    pitchId: fixture.pitchId,
    start: start.toISOString(),
    end: new Date(start.getTime() + 3_600_000).toISOString(),
    name: "لاعب",
    phone: nextPhone(),
  };
}

function freeOf(strip: FreeStrip) {
  if (strip.kind !== "free") throw new Error(`expected a free strip, got ${strip.kind}`);
  return strip;
}

/** Start instants of the chips, for the only pitch. */
function chipStarts(strip: FreeStrip): string[] {
  return freeOf(strip).pitches.flatMap((pitch) => pitch.chips.map((chip) => chip.startIso));
}

function isoHours(day: CivilDate, hours: number[]): string[] {
  return hours.map((hour) => at(day, hour).toISOString());
}

function weekdayOf(day: CivilDate): Weekday {
  return WEEKDAYS[new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay()]!;
}

/** Past games cannot go through owner-create (slot_ended); insert them directly. */
async function insertPastGame(start: Date): Promise<string> {
  return db.$transaction(async (tx) => {
    const person = await findOrCreatePerson(tx, { name: "مباراة", phone: nextPhone() });
    const id = await insertApprovedOwnerBooking(tx, {
      pitchId: fixture.pitchId,
      start,
      end: new Date(start.getTime() + 3_600_000),
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

function asSession(slug: string, token: string) {
  clearRequestStubs();
  clearReactCache();
  setTenantSlug(slug);
  setSessionCookie(token);
}

describe("Today free strip", () => {
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

  it("with bookings at 17:00 and 19:00 the chips are exactly the other hours", async () => {
    const day = inDays(3);
    await createOwnerBooking(slotArgs(day, 17));
    await createOwnerBooking(slotArgs(day, 19));
    const strip = await loadFreeStrip(formatCivilDate(day));
    expect(chipStarts(strip)).toEqual(isoHours(day, [16, 18, 20, 21]));
    expect(freeOf(strip).showPitchNames).toBe(false);
  });

  it("a PENDING request keeps the chip and adds the badge; approving removes the chip", async () => {
    const day = inDays(3);
    const { bookingId } = await requestPublicSlot(slotArgs(day, 18));
    await requestPublicSlot(slotArgs(day, 18));
    const before = freeOf(await loadFreeStrip(formatCivilDate(day)));
    expect(before.pitches[0]!.chips.map((chip) => [chip.startIso, chip.pending])).toEqual(
      ALL_HOURS.map((hour) => [at(day, hour).toISOString(), hour === 18 ? 2 : 0]),
    );

    await approveBooking(bookingId);
    const after = await loadFreeStrip(formatCivilDate(day));
    expect(chipStarts(after)).toEqual(isoHours(day, [16, 17, 19, 20, 21]));
  });

  it("today hides started slots; a past day has no strip", async () => {
    const day = inDays(3);
    const now = new Date(at(day, 18).getTime() + 30 * 60_000);
    const today = await loadFreeStrip(undefined, now);
    expect(chipStarts(today)).toEqual(isoHours(day, [19, 20, 21]));
    // A slot starting exactly now is already started.
    const exact = await loadFreeStrip(undefined, at(day, 19));
    expect(chipStarts(exact)).toEqual(isoHours(day, [20, 21]));

    const yesterday = await loadFreeStrip(formatCivilDate(addCalendarDays(day, -1)), now);
    expect(yesterday).toEqual({ kind: "none" });
  });

  it("a future day shows every slot, and a price only where a rule changes it", async () => {
    const day = inDays(10);
    const weekday = weekdayOf(day);
    await platformDb.pitch.update({
      where: { id: fixture.pitchId },
      data: {
        scheduleConfig: parseScheduleConfig({
          ...CLOSED_WEEK_SCHEDULE,
          slotDurationMinutes: 60,
          gapMinutes: 0,
          defaultPriceUsd: "30.00",
          priceRules: [{ days: [weekday], priceUsd: "45.00", start: "20:00", end: "22:00" }],
          hours: { ...CLOSED_WEEK_SCHEDULE.hours, [weekday]: [{ start: "16:00", end: "22:00" }] },
        }),
      },
    });
    const chips = freeOf(await loadFreeStrip(formatCivilDate(day))).pitches[0]!.chips;
    expect(chips.map((chip) => chip.priceUsd)).toEqual([null, null, null, null, "45.00", "45.00"]);
  });

  it("puts Friday's post-midnight slots on Friday's business day, not Saturday's", async () => {
    let friday = inDays(2);
    while (weekdayOf(friday) !== "fri") friday = addCalendarDays(friday, 1);
    await platformDb.pitch.update({
      where: { id: fixture.pitchId },
      data: {
        scheduleConfig: parseScheduleConfig({
          ...CLOSED_WEEK_SCHEDULE,
          slotDurationMinutes: 60,
          gapMinutes: 0,
          defaultPriceUsd: "30.00",
          priceRules: [],
          hours: { ...CLOSED_WEEK_SCHEDULE.hours, fri: [{ start: "22:00", end: "02:00" }] },
        }),
      },
    });
    const saturday = addCalendarDays(friday, 1);
    expect(chipStarts(await loadFreeStrip(formatCivilDate(friday)))).toEqual([
      at(friday, 22).toISOString(),
      at(friday, 23).toISOString(),
      at(saturday, 0).toISOString(),
      at(saturday, 1).toISOString(),
    ]);
    expect(await loadFreeStrip(formatCivilDate(saturday))).toEqual({ kind: "closed" });

    // Booked at 00:00 Saturday, that chip goes from Friday's strip.
    await createOwnerBooking(slotArgs(saturday, 0));
    expect(chipStarts(await loadFreeStrip(formatCivilDate(friday)))).toHaveLength(3);
  });

  it("shows one Closed result when no pitch has hours that day", async () => {
    await platformDb.pitch.update({
      where: { id: fixture.pitchId },
      data: { scheduleConfig: parseScheduleConfig(CLOSED_WEEK_SCHEDULE) },
    });
    expect(await loadFreeStrip(formatCivilDate(inDays(2)))).toEqual({ kind: "closed" });
  });

  it("another tenant's bookings and requests never touch this strip", async () => {
    await truncateAll();
    const { a, b } = await seedTwoTenants();
    const day = inDays(3);

    asSession(b.tenantSlug, b.sessionId);
    fixture = b;
    await createOwnerBooking(slotArgs(day, 17));
    await requestPublicSlot(slotArgs(day, 18));

    asSession(a.tenantSlug, a.sessionId);
    fixture = a;
    const strip = freeOf(await loadFreeStrip(formatCivilDate(day)));
    expect(strip.pitches[0]!.chips.map((chip) => [chip.startIso, chip.pending])).toEqual(
      ALL_HOURS.map((hour) => [at(day, hour).toISOString(), 0]),
    );
  });

  it("staff without bookings.create sees the chips but cannot act", async () => {
    const day = inDays(3);
    await requestPublicSlot(slotArgs(day, 18));
    asSession(fixture.tenantSlug, await createStaffSession(fixture.tenantId, {}));

    const strip = freeOf(await loadFreeStrip(formatCivilDate(day)));
    expect(strip.pitches[0]!.chips).toHaveLength(6);
    await expect(createOwnerBooking(slotArgs(day, 17))).rejects.toMatchObject({
      key: "access.not_allowed",
    });

    const render = (mayBook: boolean) =>
      renderToStaticMarkup(
        createElement(FreeStripView, {
          pitches: strip.pitches,
          showPitchNames: false,
          day: strip.day,
          mayBook,
          locale: "en",
        }),
      );
    expect(render(false)).not.toContain("<button");
    expect(render(false)).toContain("<li");
    expect(render(true)).toContain("<button");
  });

  it("To collect: the loader hands over the two unpaid ended games and their $60", async () => {
    const past = inDays(-1);
    await insertPastGame(at(past, 17));
    await insertPastGame(at(past, 19));
    const day = await loadOwnerDay(undefined);
    expect(day.toCollect).toHaveLength(2);
    const total = day.toCollect.reduce((sum, row) => sum.plus(row.remaining), new Decimal(0));
    expect(total.equals("60")).toBe(true);
    expect(day.toCollectHasMore).toBe(false);
  });

  it("the strip adds three batched reads to a Today render, however many slots", async () => {
    const day = inDays(3);
    for (const hour of [16, 18]) await requestPublicSlot(slotArgs(day, hour));
    await createOwnerBooking(slotArgs(day, 17));
    const render = async (withStrip: boolean) => {
      clearReactCache();
      return countQueries(async () => {
        await getCurrentMembership();
        await getCurrentTenant();
        await loadOwnerDay(formatCivilDate(day));
        await listOpenWaitlist();
        await listPendingRequests();
        if (withStrip) await loadFreeStrip(formatCivilDate(day));
      });
    };
    const before = await render(false);
    const after = await render(true);
    console.log(`Today render queries: before=${before} after=${after}`);
    expect(after - before).toBeLessThanOrEqual(3);
  });
});

/** Count statements sent to Postgres (BEGIN/COMMIT and session SET excluded). */
async function countQueries(run: () => Promise<void>): Promise<number> {
  const proto = pg.Client.prototype as unknown as { query: (...args: unknown[]) => unknown };
  const original = proto.query;
  let count = 0;
  proto.query = function (this: unknown, ...args: unknown[]) {
    const first = args[0];
    const text = typeof first === "string" ? first : ((first as { text?: string })?.text ?? "");
    if (!/^\s*(BEGIN|COMMIT|ROLLBACK|SET |SELECT set_config)/i.test(text)) count += 1;
    return original.apply(this, args);
  };
  try {
    await run();
  } finally {
    proto.query = original;
  }
  return count;
}
