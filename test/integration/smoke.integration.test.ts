import { describe, expect, it, beforeEach, afterAll } from "@jest/globals";
import { truncateAll } from "./truncate";
import { seedMinimalFixture } from "./fixtures";
import { platformDb } from "@/lib/platform-db";
import { prismaBase } from "@/lib/prisma-base";

/**
 * Phase 0 smoke: stadiums_test is migrated, truncate works, fixture inserts stick.
 */
describe("integration harness smoke", () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await truncateAll();
    await prismaBase.$disconnect();
  });

  it("connects to stadiums_test and has the exclusion constraint", async () => {
    expect(process.env.STADIUMS_INTEGRATION).toBe("1");
    const url = process.env.DATABASE_URL ?? "";
    expect(url).toContain("/stadiums_test");

    const rows = await platformDb.$queryRaw<
      { conname: string }[]
    >`SELECT conname FROM pg_constraint WHERE conname = 'Booking_approved_during_excl'`;
    expect(rows).toHaveLength(1);
  });

  it("seeds a tenant + pitch and truncate clears them", async () => {
    const fixture = await seedMinimalFixture();
    expect(fixture.tenantSlug).toBe("test-stadium");

    const found = await platformDb.tenant.findUnique({
      where: { slug: "test-stadium" },
    });
    expect(found?.id).toBe(fixture.tenantId);

    const pitch = await platformDb.pitch.findUnique({
      where: { id: fixture.pitchId },
    });
    expect(pitch?.name).toBe("Pitch T1");

    await truncateAll();

    const after = await platformDb.tenant.findUnique({
      where: { slug: "test-stadium" },
    });
    expect(after).toBeNull();
  });
});
