import { expect } from "@jest/globals";
import Decimal from "decimal.js";
import db from "@/lib/db";
import { platformDb } from "@/lib/platform-db";
import { summarizeDay, type DaySummaryRow } from "@/modules/booking/domain/day-summary";
import { businessDate } from "@/modules/booking/domain/business-day";
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

  // The latest due change matches the booking's due, in the game's currency (DR-007): a USD game
  // compares the USD pair as before, an LBP game the LBP pair. A change in the other currency, or a
  // NULL on either side, is a mismatch.
  const dueMismatches = await platformDb.$queryRaw<Array<{ id: string }>>`
    SELECT b.id
    FROM "Booking" b
    JOIN LATERAL (
      SELECT d."currency", d."toUsd", d."toLbp"
      FROM "BookingDueChange" d
      WHERE d."bookingId" = b.id
        AND d."tenantId" = b."tenantId"
      ORDER BY d."createdAt" DESC, d.id DESC
      LIMIT 1
    ) latest ON true
    WHERE latest."currency" <> b."priceCurrency"
       OR (b."priceCurrency" = 'USD' AND latest."toUsd" IS DISTINCT FROM b."amountDueUsd")
       OR (b."priceCurrency" = 'LBP' AND latest."toLbp" IS DISTINCT FROM b."amountDueLbp")
  `;
  expect(dueMismatches).toHaveLength(0);

  // An LBP game's settlements never exceed its due (DR-007 decision 6), and only an LBP game has them.
  const overSettled = await platformDb.$queryRaw<Array<{ id: string }>>`
    SELECT b.id
    FROM "Booking" b
    JOIN "BookingSettlement" s ON s."bookingId" = b.id AND s."tenantId" = b."tenantId"
    GROUP BY b.id, b."priceCurrency", b."amountDueLbp"
    HAVING b."priceCurrency" <> 'LBP'::"Currency" OR SUM(s."lbpApplied") > b."amountDueLbp"
  `;
  expect(overSettled).toHaveLength(0);

  // The shares of a split game add up to its due, in its currency (DR-007 slice 7).
  const sharesOff = await platformDb.$queryRaw<Array<{ id: string }>>`
    SELECT b.id
    FROM "Booking" b
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."tenantId" = b."tenantId"
    WHERE b."collectionMode" = 'PER_PLAYER'::"CollectionMode" AND bp."slotNumber" IS NOT NULL
    GROUP BY b.id, b."priceCurrency", b."amountDueUsd", b."amountDueLbp"
    HAVING (b."priceCurrency" = 'USD' AND SUM(bp."amountDueUsd") IS DISTINCT FROM b."amountDueUsd")
        OR (b."priceCurrency" = 'LBP' AND SUM(bp."amountDueLbp") IS DISTINCT FROM b."amountDueLbp")
  `;
  expect(sharesOff).toHaveLength(0);

  // Every payment's pound allocations add up to its settlement, and none sits on a payment without one.
  const allocationsOff = await platformDb.$queryRaw<Array<{ paymentId: string }>>`
    SELECT a."paymentId"
    FROM "PaymentAllocation" a
    LEFT JOIN "BookingSettlement" s ON s."paymentId" = a."paymentId" AND s."tenantId" = a."tenantId"
    WHERE a."amountLbp" IS NOT NULL
    GROUP BY a."paymentId", s."lbpApplied"
    HAVING s."lbpApplied" IS NULL OR SUM(a."amountLbp") IS DISTINCT FROM s."lbpApplied"
  `;
  expect(allocationsOff).toHaveLength(0);

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
      const day = businessDate(row.start, 6);
      const key = `${day.year}-${day.month}-${day.day}`;
      const group = byDay.get(key) ?? [];
      group.push({
        status: row.status,
        start: row.start,
        end: row.end,
        // A USD game counts in dollars; an LBP game in pounds, from what its settlements applied.
        collectedUsd: row.currency === "USD" ? row.collected : new Decimal(0),
        ...(row.currency === "LBP"
          ? { amountDueLbp: row.amountDue, settledLbp: row.collected }
          : { amountDueUsd: row.amountDue }),
      });
      byDay.set(key, group);
    }

    let owed = new Decimal(0);
    let expected = new Decimal(0);
    let owedLbp = new Decimal(0);
    let expectedLbp = new Decimal(0);
    for (const group of byDay.values()) {
      const summary = summarizeDay(group, now);
      owed = owed.plus(summary.owedUsd);
      expected = expected.plus(summary.expectedUsd);
      owedLbp = owedLbp.plus(summary.owedLbp);
      expectedLbp = expectedLbp.plus(summary.expectedLbp);
    }

    expect(stats.owesNowUsd.equals(owed)).toBe(true);
    expect(stats.expectedUsd.equals(expected)).toBe(true);
    expect(stats.owesNowLbp.equals(owedLbp)).toBe(true);
    expect(stats.expectedLbp.equals(expectedLbp)).toBe(true);
  }
}
