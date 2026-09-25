import {
  describe,
  expect,
  it,
  beforeEach,
  afterAll,
} from "@jest/globals";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { DomainError } from "@/lib/errors";
import { requestPublicSlot } from "@/modules/booking/application/request-public-slot";
import {
  findPitchById,
  listPitches,
  updatePitchRow,
} from "@/modules/venue/infrastructure/pitches";
import { CLOSED_WEEK_SCHEDULE } from "@/modules/venue/schemas/schedule-config";
import {
  clearRequestStubs,
  setSessionCookie,
  setTenantSlug,
} from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";
import { seedTwoTenants, type TestFixture } from "./fixtures";

/**
 * RULE-7 / BR-64 — complete separation between stadiums on a shared database.
 *
 * Two tenants in stadiums_test; every case runs under tenant A's slug + session.
 * Proves the Prisma tenant extension (and use cases that depend on it) block
 * cross-tenant read / list / write — not just that the architecture looks right.
 */
describe("tenant isolation (RULE-7)", () => {
  let a: TestFixture;
  let b: TestFixture;

  /** Monday 2026-10-05 16:00–17:00 Asia/Beirut → 13:00–14:00 UTC (inside openEvenings). */
  const start = new Date("2026-10-05T13:00:00.000Z");
  const end = new Date("2026-10-05T14:00:00.000Z");

  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    ({ a, b } = await seedTwoTenants());
    setTenantSlug(a.tenantSlug);
    setSessionCookie(a.sessionId);
  });

  afterAll(async () => {
    await truncateAll();
    await finishIntegrationFile();
  });

  it("findUnique-style: other-tenant pitch id returns null under A", async () => {
    const leaked = await findPitchById(db, b.pitchId);
    expect(leaked).toBeNull();

    const own = await findPitchById(db, a.pitchId);
    expect(own?.id).toBe(a.pitchId);
  });

  it("findMany-style: listPitches under A never includes B's pitch", async () => {
    const pitches = await listPitches();
    const ids = pitches.map((p) => p.id);
    expect(ids).toContain(a.pitchId);
    expect(ids).not.toContain(b.pitchId);
  });

  it("update-style: mutating B's pitch under A throws; B row unchanged", async () => {
    const before = await platformDb.pitch.findUnique({
      where: { id: b.pitchId },
      select: { name: true, tenantId: true },
    });
    expect(before?.tenantId).toBe(b.tenantId);
    expect(before?.name).toBe("Pitch Other");

    await expect(
      updatePitchRow(db, {
        pitchId: b.pitchId,
        name: "Hijacked",
        scheduleConfig: CLOSED_WEEK_SCHEDULE,
      }),
    ).rejects.toThrow(/Tenant scope violation/);

    const after = await platformDb.pitch.findUnique({
      where: { id: b.pitchId },
      select: { name: true },
    });
    expect(after?.name).toBe("Pitch Other");
  });

  it("use case: requestPublicSlot with B's pitchId under A → pitch_not_found, no B booking", async () => {
    let caught: unknown;
    try {
      await requestPublicSlot({
        name: "Cross Tenant",
        phone: "03123456",
        pitchId: b.pitchId,
        start: start.toISOString(),
        end: end.toISOString(),
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DomainError);
    expect((caught as DomainError).key).toBe("booking.pitch_not_found");

    const bookingsOnB = await platformDb.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "Booking" WHERE "pitchId" = ${b.pitchId}
    `;
    expect(Number(bookingsOnB[0]?.n ?? 0)).toBe(0);

    const bookingsOnA = await platformDb.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*)::bigint AS n FROM "Booking" WHERE "pitchId" = ${a.pitchId}
    `;
    expect(Number(bookingsOnA[0]?.n ?? 0)).toBe(0);
  });
});
