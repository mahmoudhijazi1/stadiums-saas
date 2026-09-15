import { platformDb } from "@/lib/platform-db";
import { hashPassword } from "@/modules/access/infrastructure/password";
import { CLOSED_WEEK_SCHEDULE } from "@/modules/venue/schemas/schedule-config";
import type { ScheduleConfig, Weekday } from "@/modules/venue/schemas/schedule-config";
import { parseScheduleConfig } from "@/modules/venue/schemas/schedule-config";

const EVENING = [{ start: "16:00", end: "22:00" }];

function openEvenings(): ScheduleConfig {
  const hours = { ...CLOSED_WEEK_SCHEDULE.hours } as ScheduleConfig["hours"];
  for (const day of [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
    "sat",
    "sun",
  ] as Weekday[]) {
    hours[day] = EVENING;
  }
  return parseScheduleConfig({
    slotDurationMinutes: 60,
    gapMinutes: 0,
    hours,
    defaultPriceUsd: "30.00",
    priceRules: [],
  });
}

export type TestFixture = {
  tenantId: string;
  tenantSlug: string;
  pitchId: string;
  ownerUserId: string;
  ownerIdentifier: string;
  sessionId: string;
};

export type SeedMinimalOptions = {
  tenantSlug?: string;
  tenantName?: string;
  pitchName?: string;
  ownerIdentifier?: string;
  ownerPassword?: string;
};

/**
 * Minimal tenant + pitch + OWNER user/membership/session on stadiums_test.
 * Call after truncateAll(). Uses platformDb (unscoped) — fine outside a request tx.
 * Defaults preserve existing integration suites; pass options for a second stadium.
 */
export async function seedMinimalFixture(
  options: SeedMinimalOptions = {},
): Promise<TestFixture> {
  const tenantSlug = options.tenantSlug ?? "test-stadium";
  const tenantName = options.tenantName ?? "Test Stadium";
  const pitchName = options.pitchName ?? "Pitch T1";
  const ownerIdentifier = options.ownerIdentifier ?? "owner@test-stadium";
  const ownerPassword = options.ownerPassword ?? "test-owner-password";

  const tenant = await platformDb.tenant.create({
    data: { slug: tenantSlug, name: tenantName },
    select: { id: true, slug: true },
  });

  const pitch = await platformDb.pitch.create({
    data: {
      tenantId: tenant.id,
      name: pitchName,
      scheduleConfig: openEvenings(),
    } as Parameters<typeof platformDb.pitch.create>[0]["data"],
    select: { id: true },
  });

  const passwordHash = await hashPassword(ownerPassword);
  const user = await platformDb.user.create({
    data: {
      identifier: ownerIdentifier,
      passwordHash,
    },
    select: { id: true, identifier: true },
  });

  await platformDb.membership.create({
    data: {
      tenantId: tenant.id,
      userId: user.id,
      role: "OWNER",
      permissions: {},
    } as Parameters<typeof platformDb.membership.create>[0]["data"],
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await platformDb.session.create({
    data: { userId: user.id, expiresAt },
    select: { id: true },
  });

  return {
    tenantId: tenant.id,
    tenantSlug: tenant.slug,
    pitchId: pitch.id,
    ownerUserId: user.id,
    ownerIdentifier: user.identifier,
    sessionId: session.id,
  };
}

/**
 * Two full stadiums for RULE-7 isolation suites. Same shape; distinct slugs/ids.
 */
export async function seedTwoTenants(): Promise<{
  a: TestFixture;
  b: TestFixture;
}> {
  const a = await seedMinimalFixture();
  const b = await seedMinimalFixture({
    tenantSlug: "other-stadium",
    tenantName: "Other Stadium",
    pitchName: "Pitch Other",
    ownerIdentifier: "owner@other-stadium",
  });
  return { a, b };
}
