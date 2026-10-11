import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import pg from "pg";
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
 * The canonical_phones migration on real rows: duplicates merge into the earliest person, every
 * reference moves, unconvertible phones stay, other tenants are only canonicalized, amounts do not
 * change, a second run changes nothing, and two people of one group on one booking stop it.
 * `prisma migrate deploy` has already applied the file once on the empty test database; the file
 * text is run again here by hand on seeded rows. NOT RUN when written: unverified until
 * `npm run test:integration` has run.
 */
const TIME_ZONE = "Asia/Beirut";
const SQL = readFileSync(join(process.cwd(), "src", "prisma", "migrations", "20261014090000_canonical_phones", "migration.sql"), "utf8");

let a: TestFixture;
let b: TestFixture;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL_TEST });
const connected = client.connect();

afterAll(async () => {
  await connected;
  await client.end();
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
  ({ a, b } = await seedTwoTenants());
});

async function runMigration() {
  await connected;
  await client.query(SQL);
}

async function window(fixture: TestFixture, daysAhead: number, index = 0) {
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

/** A public request (creates the person, a PENDING booking and its requester participant). */
async function request(fixture: TestFixture, name: string, phone: string, daysAhead: number) {
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  const slot = await window(fixture, daysAhead);
  const { bookingId } = await requestPublicSlot(
    parsePublicSlotRequest({ name, phone, pitchId: fixture.pitchId, ...slot }),
  );
  const participant = await platformDb.bookingParticipant.findFirstOrThrow({ where: { bookingId, isRequester: true } });
  return { bookingId, personId: participant.personId!, slot };
}

async function personOf(personId: string) {
  return platformDb.person.findUniqueOrThrow({ where: { id: personId } });
}

/** Two people of one stadium stored the old way: the older as "71123456", the newer as 961 digits. */
async function seedGroup() {
  const old = await request(a, "Old", "96171123456", 3);
  await platformDb.person.update({
    where: { id: old.personId },
    data: { phone: "71123456", createdAt: new Date("2026-01-01T00:00:00Z") },
  });
  const newer = await request(a, "New", "96171123456", 4);
  await platformDb.person.update({ where: { id: newer.personId }, data: { createdAt: new Date("2026-02-01T00:00:00Z") } });
  return { old, newer };
}

async function snapshot() {
  const [people, participants, sales, interests] = await Promise.all([
    platformDb.person.findMany({ orderBy: { id: "asc" }, select: { id: true, tenantId: true, phone: true } }),
    platformDb.bookingParticipant.findMany({ orderBy: { id: "asc" }, select: { id: true, personId: true, amountDueUsd: true } }),
    platformDb.sale.findMany({ orderBy: { id: "asc" }, select: { id: true, payerPersonId: true, payerPhone: true } }),
    platformDb.$queryRaw<{ id: string; personId: string }[]>`SELECT id, "personId" FROM "SlotInterest" ORDER BY id`,
  ]);
  return JSON.stringify({ people, participants, sales, interests });
}

describe("canonical_phones migration", () => {
  it("merges a group into the earliest person, moves every reference, and leaves the rest alone", async () => {
    const { old, newer } = await seedGroup();
    const membership = await platformDb.membership.findFirstOrThrow({ where: { tenantId: a.tenantId, role: "OWNER" } });
    for (const [person, booking] of [[old.personId, old.bookingId], [newer.personId, newer.bookingId]] as const) {
      await platformDb.sale.create({
        data: { tenantId: a.tenantId, createdByMembershipId: membership.id, bookingId: booking, payerPersonId: person },
      });
    }
    await platformDb.sale.create({
      data: { tenantId: a.tenantId, createdByMembershipId: membership.id, bookingId: old.bookingId, payerName: "Typed", payerPhone: "71123456" },
    });
    // The same waitlist window for both: one row must remain on the survivor.
    for (const personId of [old.personId, newer.personId]) {
      await platformDb.$executeRaw`
        INSERT INTO "SlotInterest" (id, "tenantId", "pitchId", during, "personId")
        VALUES (${`si-${personId}`}, ${a.tenantId}, ${a.pitchId}, tstzrange(${new Date(old.slot.start)}, ${new Date(old.slot.end)}, '[)'), ${personId})`;
    }
    const syrian = await platformDb.person.create({
      data: { tenantId: a.tenantId, name: "Syrian", phone: "0933123456", searchName: "syrian" },
    });
    const other = await platformDb.person.create({
      data: { tenantId: b.tenantId, name: "Other", phone: "71123456", searchName: "other" },
    });
    await platformDb.tenant.update({ where: { id: a.tenantId }, data: { settings: { phone: "03123456", whatsapp: "0933123456" } } });
    const amountsBefore = (await platformDb.bookingParticipant.findMany({ select: { id: true, amountDueUsd: true }, orderBy: { id: "asc" } })).map(
      (row) => `${row.id}:${row.amountDueUsd.toString()}`,
    );

    await runMigration();

    const people = await platformDb.person.findMany({ where: { tenantId: a.tenantId, phone: "96171123456" } });
    expect(people.map((person) => person.id)).toEqual([old.personId]); // the earliest survives
    await expect(platformDb.person.findUnique({ where: { id: newer.personId } })).resolves.toBeNull();

    const participants = await platformDb.bookingParticipant.findMany({ where: { bookingId: { in: [old.bookingId, newer.bookingId] } } });
    expect(participants.map((row) => row.personId)).toEqual([old.personId, old.personId]);
    const sales = await platformDb.sale.findMany({ where: { tenantId: a.tenantId } });
    expect(sales.filter((sale) => sale.payerPersonId !== null).map((sale) => sale.payerPersonId)).toEqual([old.personId, old.personId]);
    expect(sales.find((sale) => sale.payerName === "Typed")!.payerPhone).toBe("96171123456");
    const interests = await platformDb.$queryRaw<{ personId: string }[]>`SELECT "personId" FROM "SlotInterest"`;
    expect(interests).toEqual([{ personId: old.personId }]);

    expect((await personOf(syrian.id)).phone).toBe("0933123456"); // unconvertible: unchanged
    expect((await personOf(other.id)).phone).toBe("96171123456"); // other stadium: only canonicalized
    expect(await platformDb.person.count({ where: { tenantId: b.tenantId } })).toBe(1);

    const settings = (await platformDb.tenant.findUniqueOrThrow({ where: { id: a.tenantId } })).settings as Record<string, string>;
    expect(settings.phone).toBe("9613123456");
    expect(settings.whatsapp).toBe("0933123456");

    const amountsAfter = (await platformDb.bookingParticipant.findMany({ select: { id: true, amountDueUsd: true }, orderBy: { id: "asc" } })).map(
      (row) => `${row.id}:${row.amountDueUsd.toString()}`,
    );
    expect(amountsAfter).toEqual(amountsBefore);
  });

  it("changes nothing the second time", async () => {
    await seedGroup();
    await platformDb.person.create({ data: { tenantId: b.tenantId, name: "Other", phone: "71123456", searchName: "other" } });
    await runMigration();
    const once = await snapshot();
    await runMigration();
    expect(await snapshot()).toBe(once);
  });

  it("stops, changing nothing, when two people of one group are on the same booking", async () => {
    const { old, newer } = await seedGroup();
    await platformDb.bookingParticipant.create({
      data: { tenantId: a.tenantId, bookingId: old.bookingId, personId: newer.personId, amountDueUsd: "0.00", isRequester: false },
    });
    const before = await snapshot();
    await expect(runMigration()).rejects.toThrow(/same booking/);
    expect(await snapshot()).toBe(before);
  });
});
