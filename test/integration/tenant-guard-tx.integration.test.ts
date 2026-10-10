import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { updatePitch } from "@/modules/venue/application/update-pitch";
import { parsePitchDraft } from "@/modules/venue/schemas/pitch-draft";
import type { TestFixture } from "./fixtures";
import { seedMinimalFixture } from "./fixtures";
import { clearRequestStubs, setSessionCookie, setTenantSlug } from "./request-stubs";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * Hardening round 2, item 2. WRITTEN, NOT RUN when authored: unverified until
 * `npm run test:integration` has been run.
 *
 * The tenant guard used to check ownership of update/delete with a separate query on another
 * pool connection. It now puts tenantId into the write's own where, on the caller's connection.
 */
const FIELDS = {
  name: "Concurrent",
  slotDurationMinutes: "60",
  defaultPlayerCount: "10",
  defaultPriceUsd: "30",
  hoursGroups: JSON.stringify([{ days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], open: "16:00", close: "22:00" }]),
  priceRules: JSON.stringify([]),
};

let fixture: TestFixture;

beforeEach(async () => {
  await truncateAll();
  fixture = await seedMinimalFixture();
  clearRequestStubs();
  setTenantSlug(fixture.tenantSlug);
  setSessionCookie(fixture.sessionId);
});

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

describe("tenant guard on update and delete", () => {
  it("as many concurrent updatePitch calls as the pool has connections do not hang", async () => {
    const poolSize = Number(process.env.PG_POOL_MAX ?? "10");
    const calls = Array.from({ length: poolSize }, (_, i) =>
      updatePitch({
        pitchId: fixture.pitchId,
        draft: parsePitchDraft({ ...FIELDS, name: `Concurrent ${i}` }),
        liveBookings: [],
      }),
    );
    const settled = await Promise.race([
      Promise.allSettled(calls),
      new Promise<"hung">((resolve) => setTimeout(() => resolve("hung"), 20_000)),
    ]);
    expect(settled).not.toBe("hung");
    expect((settled as PromiseSettledResult<void>[]).every((r) => r.status === "fulfilled")).toBe(true);
    expect(await platformDb.pitch.count({ where: { id: fixture.pitchId } })).toBe(1);
  }, 60_000);

  it("a row created in the same transaction is visible to the ownership check", async () => {
    const renamed = await db.$transaction(async (tx) => {
      const created = await tx.person.create({
        data: { name: "Fresh", phone: "03999001", searchName: "fresh" } as Parameters<typeof tx.person.create>[0]["data"],
      });
      await tx.person.update({ where: { id: created.id }, data: { name: "Renamed" } });
      await tx.person.delete({ where: { id: created.id } });
      return created.id;
    });
    expect(await platformDb.person.findUnique({ where: { id: renamed } })).toBeNull();
  });

  it("another tenant's row is still refused for update and delete", async () => {
    const other = await seedMinimalFixture({ tenantSlug: "other-guard", tenantName: "Other", ownerIdentifier: "owner@other-guard" });
    const theirs = await platformDb.person.create({
      data: { tenantId: other.tenantId, name: "Theirs", phone: "03999002", searchName: "theirs" },
    });
    await expect(db.person.update({ where: { id: theirs.id }, data: { name: "Hijacked" } })).rejects.toThrow(/Tenant scope violation/);
    await expect(db.person.delete({ where: { id: theirs.id } })).rejects.toThrow(/Tenant scope violation/);
    expect((await platformDb.person.findUniqueOrThrow({ where: { id: theirs.id } })).name).toBe("Theirs");
  });
});
