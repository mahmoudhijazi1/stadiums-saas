import { afterAll, afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { approveBooking } from "@/modules/booking/application/approve-booking";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { parsePublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import {
  clearRequestStubs,
  setRequestHeader,
  setSessionCookie,
  setTenantSlug,
} from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Public request limits (security audit S-5): at most 3 future PENDING
 * requests per phone per stadium, 5 requests per phone per hour, 60 per IP
 * per hour only with TRUSTED_CLIENT_IP_HEADER. Every limit answers with the
 * same generic key, so nothing is learned about the phone's owner.
 */
const TIME_ZONE = "Asia/Beirut";
const LIMIT = "booking.request_limit";
const HOUR = 60 * 60 * 1000;

let fixture: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  delete process.env.TRUSTED_CLIENT_IP_HEADER;
  fixture = await seedMinimalFixture();
});

afterEach(() => {
  delete process.env.TRUSTED_CLIENT_IP_HEADER;
});

async function slot(daysAhead: number, index = 0) {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const slots = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), daysAhead),
    timeZone: TIME_ZONE,
    occupied: [],
  });
  const picked = slots[index];
  if (!picked) throw new Error(`no slot ${index} on day +${daysAhead}`);
  return { start: picked.start.toISOString(), end: picked.end.toISOString() };
}

/** A public request as the page sends it; returns "ok" or the error key. */
async function request(phone: string, daysAhead: number, index = 0, ip?: string): Promise<string> {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  if (ip) setRequestHeader("x-real-ip", ip);
  const window = await slot(daysAhead, index);
  try {
    await requestPublicSlot(
      parsePublicSlotRequest({ name: "Ali", phone, pitchId: fixture.pitchId, ...window }),
    );
    return "ok";
  } catch (error) {
    return (error as { key?: string }).key ?? String(error);
  }
}

async function rejectAllPending() {
  await platformDb.booking.updateMany({ where: { status: "PENDING" }, data: { status: "REJECTED" } });
}

async function elapse(ms: number) {
  await platformDb.$executeRaw`UPDATE "RateLimit" SET "windowStart" = "windowStart" - ${ms} * interval '1 millisecond'`;
}

describe("pending requests per phone", () => {
  it("allows 3 future PENDING requests per phone per stadium, refuses the 4th with the generic key", async () => {
    expect(await request("03111001", 2, 0)).toBe("ok");
    expect(await request("03111001", 2, 1)).toBe("ok");
    expect(await request("03111001", 3, 0)).toBe("ok");
    expect(await request("03111001", 3, 1)).toBe(LIMIT);
    // Another phone is not affected.
    expect(await request("03111002", 3, 1)).toBe("ok");
    expect(await platformDb.booking.count({ where: { status: "PENDING" } })).toBe(4);
  });

  it("a decided request frees a place", async () => {
    await request("03111001", 2, 0);
    await request("03111001", 2, 1);
    await request("03111001", 3, 0);
    await rejectAllPending();
    expect(await request("03111001", 3, 1)).toBe("ok");
  });
});

describe("requests per phone per hour", () => {
  it("5 per hour, the 6th refused with the generic key; the next hour is fine", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect(await request("03111001", 2 + i, 0)).toBe("ok");
      await rejectAllPending();
    }
    expect(await request("03111001", 8, 0)).toBe(LIMIT);
    await elapse(HOUR);
    expect(await request("03111001", 8, 0)).toBe("ok");
  });

  it("counts requests for a taken hour too, and records one interest per person and window", async () => {
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
    expect(await request("03999999", 2, 0)).toBe("ok");
    const booking = await platformDb.booking.findFirstOrThrow({ where: { status: "PENDING" } });
    clearRequestStubs();
    setTenantSlug(fixture.tenantSlug);
    setSessionCookie(fixture.sessionId);
    await approveBooking(booking.id);

    for (let i = 0; i < 5; i += 1) {
      expect(await request("03111001", 2, 0)).toBe("booking.slot_taken");
    }
    expect(await platformDb.slotInterest.count()).toBe(1);
    expect(await request("03111001", 2, 0)).toBe(LIMIT);
  });
});

describe("requests per IP", () => {
  it("no IP limit without TRUSTED_CLIENT_IP_HEADER", async () => {
    for (let i = 0; i < 61; i += 1) {
      expect(await request(`0311${String(i).padStart(4, "0")}`, 2, 0, "203.0.113.9")).toBe("ok");
    }
  });

  it("60 per hour per IP with the setting; another IP is fine", async () => {
    process.env.TRUSTED_CLIENT_IP_HEADER = "x-real-ip";
    for (let i = 0; i < 60; i += 1) {
      expect(await request(`0311${String(i).padStart(4, "0")}`, 2, 0, "203.0.113.9")).toBe("ok");
    }
    expect(await request("03119999", 2, 0, "203.0.113.9")).toBe(LIMIT);
    expect(await request("03119999", 2, 0, "198.51.100.7")).toBe("ok");
  });
});

describe("generic answers", () => {
  it("every limit uses the same key, which has copy in both languages", async () => {
    const { errorMessage } = await import("@/lib/error-messages");
    expect(errorMessage(LIMIT, "ar")).not.toBe(errorMessage("error.generic", "ar"));
    expect(errorMessage(LIMIT, "en")).not.toBe(errorMessage("error.generic", "en"));
  });
});
