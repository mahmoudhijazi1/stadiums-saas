import {
  describe,
  expect,
  it,
  beforeEach,
  afterAll,
} from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { prismaBase } from "@/lib/prisma-base";
import { DomainError } from "@/lib/errors";
import { isExclusionViolation } from "@/modules/booking/domain/exclusion";
import { insertApprovedOwnerBooking } from "@/modules/booking/infrastructure/bookings";
import { clearRequestStubs, setTenantSlug } from "../../../integration/request-stubs";
import { truncateAll } from "../../../integration/truncate";
import { seedMinimalFixture, type TestFixture } from "../../../integration/fixtures";

describe("isExclusionViolation (real Postgres 23P01)", () => {
  let fixture: TestFixture;
  const start = new Date("2026-10-05T14:00:00.000Z");
  const end = new Date("2026-10-05T15:00:00.000Z");

  beforeEach(async () => {
    await truncateAll();
    clearRequestStubs();
    fixture = await seedMinimalFixture();
    setTenantSlug(fixture.tenantSlug);
  });

  afterAll(async () => {
    await truncateAll();
    await prismaBase.$disconnect();
  });

  it("returns true for a real Booking_approved_during_excl violation", async () => {
    await db.$transaction(async (tx) => {
      await insertApprovedOwnerBooking(tx, {
        pitchId: fixture.pitchId,
        start,
        end,
        priceUsd: new Decimal("30.00"),
      });
    });

    let caught: unknown;
    try {
      await db.$transaction(async (tx) => {
        await insertApprovedOwnerBooking(tx, {
          pitchId: fixture.pitchId,
          start,
          end,
          priceUsd: new Decimal("30.00"),
        });
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    expect(isExclusionViolation(caught)).toBe(true);
  });

  it("returns false for a non-exclusion error", async () => {
    const domain = new DomainError("booking.not_found");
    expect(isExclusionViolation(domain)).toBe(false);

    let caught: unknown;
    try {
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT 1/0`;
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    expect(isExclusionViolation(caught)).toBe(false);
  });
});
