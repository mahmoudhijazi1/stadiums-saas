import { expect } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { summarizeDay, type DaySummaryRow } from "@/modules/booking/domain/day-summary";
import { bookingStartDay } from "@/modules/booking/domain/start-day";
import { getPersonBookingStats } from "@/modules/booking/application/get-person-booking-stats";
import { listPersonStatRows } from "@/modules/booking/infrastructure/bookings";

/**
 * Money and overlap checks for the current stadiums_test contents.
 * Call after each booking/money scenario, under the tenant that owns `personIds`.
 * One `now` is shared by the day summary and is the moment person stats are read.
 */
export async function assertMoneyInvariants(personIds: string[]): Promise<void> {
  const now = new Date();

  const [ledger] = await platformDb.$queryRaw<Array<{ sum: string }>>`
    SELECT COALESCE(SUM("amountUsd"), 0)::text AS sum
    FROM "LedgerEntry"
    WHERE direction = 'IN'::"LedgerDirection"
      AND "sourceType" = 'BOOKING'::"PaymentSourceType"
  `;
  const [tenders] = await platformDb.$queryRaw<Array<{ sum: string }>>`
    SELECT COALESCE(SUM(t."usdEquivalent"), 0)::text AS sum
    FROM "PaymentTender" t
    JOIN "Payment" p ON p.id = t."paymentId"
    WHERE p."sourceType" = 'BOOKING'::"PaymentSourceType"
  `;
  expect(new Decimal(ledger?.sum ?? "0").equals(new Decimal(tenders?.sum ?? "0"))).toBe(
    true,
  );

  const dueMismatches = await platformDb.$queryRaw<Array<{ id: string }>>`
    SELECT b.id
    FROM "Booking" b
    JOIN LATERAL (
      SELECT d."toUsd"
      FROM "BookingDueChange" d
      WHERE d."bookingId" = b.id
        AND d."tenantId" = b."tenantId"
      ORDER BY d."createdAt" DESC, d.id DESC
      LIMIT 1
    ) latest ON true
    WHERE latest."toUsd" <> b."amountDueUsd"
  `;
  expect(dueMismatches).toHaveLength(0);

  const overlaps = await platformDb.$queryRaw<Array<{ id: string }>>`
    SELECT a.id
    FROM "Booking" a
    JOIN "Booking" b
      ON a."pitchId" = b."pitchId"
     AND a.id < b.id
     AND a.status = 'APPROVED'::"BookingStatus"
     AND b.status = 'APPROVED'::"BookingStatus"
     AND a.during && b.during
  `;
  expect(overlaps).toHaveLength(0);

  for (const personId of personIds) {
    const stats = await getPersonBookingStats(personId);
    const rows = await listPersonStatRows(db, personId);
    const byDay = new Map<string, DaySummaryRow[]>();
    for (const row of rows) {
      const day = bookingStartDay(row.start);
      const key = `${day.year}-${day.month}-${day.day}`;
      const group = byDay.get(key) ?? [];
      group.push({
        status: row.status,
        start: row.start,
        end: row.end,
        amountDueUsd: row.amountDueUsd,
        collectedUsd: row.collectedUsd,
      });
      byDay.set(key, group);
    }

    let owed = new Decimal(0);
    let expected = new Decimal(0);
    for (const group of byDay.values()) {
      const summary = summarizeDay(group, now);
      owed = owed.plus(summary.owedUsd);
      expected = expected.plus(summary.expectedUsd);
    }

    expect(stats.owesNowUsd.equals(owed)).toBe(true);
    expect(stats.expectedUsd.equals(expected)).toBe(true);
  }
}
