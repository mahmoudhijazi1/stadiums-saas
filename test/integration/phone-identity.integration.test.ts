import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import { parsePublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";
import {
  addCalendarDays,
  civilDateInTimeZone,
  generateSlotsForDay,
} from "@/modules/venue/domain/availability";
import { parseScheduleConfig } from "@/modules/venue/domain/schedule-config";
import type { TestFixture } from "./fixtures";
import { seedTwoTenants } from "./fixtures";
import { clearRequestStubs, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * One phone, one Person: every way of writing the same number reaches the same row and the same
 * rate-limit counter, because the edge (the Zod schema) makes the phone canonical. NOT RUN when
 * written (no suites were to be run): read as unverified until `npm run test:integration` has run.
 */
const TIME_ZONE = "Asia/Beirut";

let a: TestFixture;
let b: TestFixture;

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  ({ a, b } = await seedTwoTenants());
});

async function slot(fixture: TestFixture, daysAhead: number, index = 0) {
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

/** A public request as the page sends it (the schema runs first). */
async function request(fixture: TestFixture, phone: string, daysAhead: number, country?: string) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  const window = await slot(fixture, daysAhead);
  await requestPublicSlot(
    parsePublicSlotRequest({
      name: "Ali",
      phone,
      ...(country ? { country } : {}),
      pitchId: fixture.pitchId,
      ...window,
    }),
  );
}

describe("canonical phone identity", () => {
  it("three ways of writing one Lebanese number are one Person and one rate-limit counter", async () => {
    await request(a, "71123456", 3);
    await request(a, "+961 71 123 456", 4);
    await request(a, "0096171123456", 5);

    const people = await platformDb.person.findMany({ where: { tenantId: a.tenantId } });
    expect(people).toHaveLength(1);
    expect(people[0]!.phone).toBe("96171123456");

    const counters = await platformDb.rateLimit.findMany({ where: { key: { startsWith: "public:phone:" } } });
    expect(counters).toHaveLength(1);
    expect(counters[0]!.key).toBe(`public:phone:${a.tenantId}:96171123456`);
    expect(counters[0]!.count).toBe(3);
  });

  it("a number from another country is stored with its country code and reused", async () => {
    await request(a, "+963933123456", 3);
    await request(a, "0933123456", 4, "963");
    await request(a, "00963933123456", 5);

    const people = await platformDb.person.findMany({ where: { tenantId: a.tenantId } });
    expect(people).toHaveLength(1);
    expect(people[0]!.phone).toBe("963933123456");
  });

  it("the same phone at a second stadium is its own Person", async () => {
    await request(a, "71123456", 3);
    await request(b, "+961 71 123 456", 3);

    const people = await platformDb.person.findMany({ orderBy: { createdAt: "asc" } });
    expect(people).toHaveLength(2);
    expect(people.map((person) => person.phone)).toEqual(["96171123456", "96171123456"]);
    expect(new Set(people.map((person) => person.tenantId))).toEqual(new Set([a.tenantId, b.tenantId]));
  });
});
