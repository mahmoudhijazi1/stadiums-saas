import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { createOwnerBooking } from "@/modules/booking/application/create-owner-booking";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { listPendingRequests } from "@/modules/booking/application/list-pending-requests";
import { parsePublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Security audit S-6: a public request under a known phone keeps the stored
 * Person name and records what was typed on Booking.requestedName, but only
 * when the normalizeName folds differ.
 */
const TIME_ZONE = "Asia/Beirut";
const PHONE = "03111001";

let fixture: TestFixture;
let dayOffset = 2;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  dayOffset = 2;
  signIn();
});

function signIn() {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
}

async function nextSlot() {
  const pitch = await platformDb.pitch.findUniqueOrThrow({ where: { id: fixture.pitchId } });
  const [slot] = generateSlotsForDay({
    config: parseScheduleConfig(pitch.scheduleConfig),
    localDate: addCalendarDays(civilDateInTimeZone(new Date(), TIME_ZONE), dayOffset++),
    timeZone: TIME_ZONE,
    occupied: [],
  });
  if (!slot) throw new Error("no slot");
  return { start: slot.start.toISOString(), end: slot.end.toISOString() };
}

async function publicRequest(name: string, phone = PHONE): Promise<string> {
  signIn();
  const { bookingId } = await requestPublicSlot(
    parsePublicSlotRequest({ name, phone, pitchId: fixture.pitchId, ...(await nextSlot()) }),
  );
  return bookingId;
}

async function requestedNameOf(bookingId: string) {
  const row = await platformDb.booking.findUniqueOrThrow({ where: { id: bookingId } });
  return row.requestedName;
}

async function savedName() {
  const person = await platformDb.person.findFirstOrThrow({ where: { phone: PHONE } });
  return person.name;
}

describe("Booking.requestedName", () => {
  it("is null for a new phone (the typed name becomes the Person name)", async () => {
    const id = await publicRequest("أحمد علي");
    expect(await requestedNameOf(id)).toBeNull();
    expect(await savedName()).toBe("أحمد علي");
  });

  it("is null for the same name in other Arabic spellings, letter case or spacing", async () => {
    await publicRequest("أحمد علي");
    for (const same of ["احمد علي", "  أحمد   علي ", "أحمَد علي", "إحمد علي"]) {
      expect(await requestedNameOf(await publicRequest(same, PHONE))).toBeNull();
      await platformDb.booking.updateMany({ where: { status: "PENDING" }, data: { status: "REJECTED" } });
    }
    await publicRequest("Ahmad Ali", "03222002");
    for (const same of ["ahmad ali", "AHMAD  ALI"]) {
      expect(await requestedNameOf(await publicRequest(same, "03222002"))).toBeNull();
    }
  });

  it("stores a genuinely different name, cleaned, and never overwrites the saved name", async () => {
    await publicRequest("أحمد علي");
    const id = await publicRequest("Sami‮ Haddad");
    expect(await requestedNameOf(id)).toBe("Sami Haddad");
    expect(await savedName()).toBe("أحمد علي");

    signIn();
    const pending = await listPendingRequests();
    const row = pending.find((entry) => entry.id === id);
    expect(row?.requesterName).toBe("أحمد علي");
    expect(row?.requestedName).toBe("Sami Haddad");
  });

  it("is null for owner-created bookings", async () => {
    await publicRequest("أحمد علي");
    signIn();
    const slot = await nextSlot();
    await createOwnerBooking({
      pitchId: fixture.pitchId,
      start: slot.start,
      end: slot.end,
      name: "Someone Else",
      phone: PHONE,
    });
    const owner = await platformDb.booking.findFirstOrThrow({ where: { source: "OWNER" } });
    expect(owner.requestedName).toBeNull();
  });
});
