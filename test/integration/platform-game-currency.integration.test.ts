import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { platformDb } from "@/lib/platform-db";
import { parseTenantSettings } from "@/lib/tenant-settings";
import { getTenantDetail } from "@/modules/platform/application/get-tenant-detail";
import { CLOSED_WEEK_SCHEDULE } from "@/modules/venue/domain/schedule-config";
import type { OperatorIo } from "../../scripts/lib/operator-io";
import { runPlatformCommand } from "../../scripts/platform-cli";
import { finishIntegrationFile } from "./teardown";
import { truncateAll } from "./truncate";

/**
 * DR-007 slice 4: `tenants set-game-currency <slug> USD|LBP`. Database name, then the pitches without
 * prices in the new currency, then the slug typed back; one audit row; bookings never touched.
 */
const PASSWORD = "a long owner password";
const ACTOR = "cli:tester@host";

afterAll(async () => {
  await truncateAll();
  await finishIntegrationFile();
});

beforeEach(async () => {
  await truncateAll();
});

function run(argv: string[], answers: string[] = []) {
  const asked: string[] = [];
  const printed: string[] = [];
  const said: string[] = [];
  const io: OperatorIo = {
    async ask(question) {
      asked.push(question);
      const answer = answers.shift();
      if (answer === undefined) throw new Error(`unexpected prompt: ${question}`);
      return answer;
    },
    say: (line) => said.push(line),
    print: (line) => printed.push(line),
  };
  const promise = runPlatformCommand(argv, { io, interactive: true, databaseUrl: process.env.DATABASE_URL, actor: ACTOR });
  return { promise, asked, printed, said };
}

/** Al Nour, with one pitch priced in both currencies, one in dollars only, and one game booked in USD. */
async function seed() {
  await run(["tenants", "create", "--slug", "al-nour", "--name", "Al Nour"], ["stadiums_test", PASSWORD, PASSWORD]).promise;
  const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { slug: "al-nour" } });
  const both = await platformDb.pitch.create({
    data: {
      tenantId: tenant.id,
      name: "Both currencies",
      scheduleConfig: { ...CLOSED_WEEK_SCHEDULE, defaultPriceUsd: "30.00", defaultPriceLbp: "2000000" },
    },
  });
  await platformDb.pitch.create({
    data: { tenantId: tenant.id, name: "Dollars only", scheduleConfig: { ...CLOSED_WEEK_SCHEDULE, defaultPriceUsd: "30.00" } },
  });
  const bookingId = `bk_${randomUUID()}`;
  await platformDb.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source", "priceUsd", "amountDueUsd")
    VALUES (${bookingId}, ${tenant.id}, ${both.id},
      tstzrange('2030-01-01T18:00:00Z'::timestamptz, '2030-01-01T19:00:00Z'::timestamptz, '[)'),
      'PENDING'::"BookingStatus", 'OWNER'::"BookingSource", 30.00, 30.00)`;
  return { tenantId: tenant.id, bookingId };
}

/** The booking's columns, named (Prisma's raw reader cannot decode the tstzrange, so it goes as text). */
function bookingRow(bookingId: string) {
  return platformDb.$queryRaw<unknown[]>`
    SELECT "id", "tenantId", "pitchId", "during"::text AS "during", "status", "source",
      "priceCurrency", "priceUsd", "amountDueUsd", "priceLbp", "amountDueLbp"
    FROM "Booking" WHERE "id" = ${bookingId}`;
}

async function setAudits() {
  return platformDb.platformAuditLog.findMany({ where: { action: "tenant.set_game_currency" } });
}

describe("tenants set-game-currency", () => {
  it("sets the value after the database name and the slug, and writes one audit row", async () => {
    const { tenantId } = await seed();
    const { promise, asked, printed } = run(["tenants", "set-game-currency", "al-nour", "LBP"], ["stadiums_test", "al-nour"]);
    await promise;
    expect(asked).toHaveLength(2);
    expect(printed.join("\n")).toContain("game prices for al-nour: LBP");
    const tenant = await platformDb.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(parseTenantSettings(tenant.settings).gamePriceCurrency).toBe("LBP");
    const audits = await setAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ tenantId, actor: ACTOR, detail: { from: "USD", to: "LBP" } });
    // The admin stadium page shows it (read-only).
    expect((await getTenantDetail({ slug: "al-nour" })).gamePriceCurrency).toBe("LBP");
  });

  it("lists the pitches with no price in the new currency before the slug is asked", async () => {
    await seed();
    const { promise, said } = run(["tenants", "set-game-currency", "al-nour", "LBP"], ["stadiums_test", "al-nour"]);
    await promise;
    const lines = said.join("\n");
    expect(lines).toContain("Dollars only");
    expect(lines).not.toContain("Both currencies");
    expect(lines).toContain("USD now, LBP after this");
  });

  it("leaves bookings and pitches untouched", async () => {
    const { bookingId } = await seed();
    const before = await bookingRow(bookingId);
    const pitchesBefore = await platformDb.pitch.findMany({ orderBy: { id: "asc" } });
    await run(["tenants", "set-game-currency", "al-nour", "LBP"], ["stadiums_test", "al-nour"]).promise;
    expect(await bookingRow(bookingId)).toEqual(before);
    expect(await platformDb.pitch.findMany({ orderBy: { id: "asc" } })).toEqual(pitchesBefore);
  });

  it("refuses a bad currency before any prompt, a wrong slug, and the value it already has", async () => {
    await seed();
    const bad = run(["tenants", "set-game-currency", "al-nour", "EUR"]);
    await expect(bad.promise).rejects.toThrow("USD or LBP");
    expect(bad.asked).toHaveLength(0);

    await expect(run(["tenants", "set-game-currency", "al-nour", "LBP"], ["stadiums_test", "al-noor"]).promise).rejects.toThrow(
      "does not match",
    );
    await expect(run(["tenants", "set-game-currency", "al-nour", "USD"], ["stadiums_test", "al-nour"]).promise).rejects.toThrow(
      "already",
    );
    expect(await setAudits()).toHaveLength(0);
    expect(await run(["tenants", "resume", "al-nour", "LBP"]).promise.catch((error: Error) => error.message)).toContain("Usage");
  });
});
