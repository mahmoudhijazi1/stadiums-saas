import { Prisma } from "@/app/generated/prisma/client";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import type { CivilDate } from "@/modules/venue/domain/availability";
import type { SeriesAnchor } from "@/modules/booking/domain/series";

/**
 * BookingSeries rows and the series side of Booking. Booking.during is Unsupported, so the
 * Booking reads here are raw SQL with the tenant in it (the extension does not stamp raw SQL).
 */
export type SeriesRow = {
  id: string;
  pitchId: string;
  personId: string;
  anchor: SeriesAnchor;
  durationMinutes: number;
};

function civilOfDate(date: Date): CivilDate {
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export async function insertSeries(
  tx: TenantTx,
  input: {
    pitchId: string;
    personId: string;
    anchor: SeriesAnchor;
    durationMinutes: number;
    membershipId: string;
  },
): Promise<string> {
  const row = await tx.bookingSeries.create({
    data: {
      pitchId: input.pitchId,
      personId: input.personId,
      anchorDate: new Date(Date.UTC(input.anchor.date.year, input.anchor.date.month - 1, input.anchor.date.day)),
      anchorTime: `${pad(input.anchor.hour)}:${pad(input.anchor.minute)}`,
      durationMinutes: input.durationMinutes,
      createdByMembershipId: input.membershipId,
    } as Parameters<typeof tx.bookingSeries.create>[0]["data"],
    select: { id: true },
  });
  return row.id;
}

export async function findSeries(tx: TenantTx, seriesId: string): Promise<SeriesRow | null> {
  const row = await tx.bookingSeries.findFirst({
    where: { id: seriesId },
    select: { id: true, pitchId: true, personId: true, anchorDate: true, anchorTime: true, durationMinutes: true },
  });
  if (!row) return null;
  const [hour, minute] = row.anchorTime.split(":").map(Number);
  return {
    id: row.id,
    pitchId: row.pitchId,
    personId: row.personId,
    anchor: { date: civilOfDate(row.anchorDate), hour: hour ?? 0, minute: minute ?? 0 },
    durationMinutes: row.durationMinutes,
  };
}

/** The series a booking belongs to, or null. */
export async function findBookingSeriesId(tx: TenantTx, bookingId: string): Promise<string | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ seriesId: string | null }[]>`
    SELECT "seriesId" FROM "Booking" WHERE id = ${bookingId} AND "tenantId" = ${tenantId}`;
  return rows[0]?.seriesId ?? null;
}

export async function linkBookingToSeries(tx: TenantTx, bookingId: string, seriesId: string): Promise<void> {
  const tenantId = await getCurrentTenantId();
  await tx.$executeRaw`
    UPDATE "Booking" SET "seriesId" = ${seriesId}
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId} AND "seriesId" IS NULL`;
}

/** Start of the latest game in the series (any status), or null when it has none. */
export async function latestSeriesStart(tx: TenantTx, seriesId: string): Promise<Date | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ latest: Date | string | null }[]>`
    SELECT MAX(lower(during)) AS latest FROM "Booking"
    WHERE "seriesId" = ${seriesId} AND "tenantId" = ${tenantId}`;
  const latest = rows[0]?.latest;
  return latest ? new Date(latest) : null;
}

/** APPROVED games of the series that have not started, in ascending id order (the lock order). */
export async function listUpcomingApprovedIds(tx: TenantTx, seriesId: string, now: Date): Promise<string[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Booking"
    WHERE "seriesId" = ${seriesId} AND "tenantId" = ${tenantId}
      AND status = 'APPROVED'::"BookingStatus" AND lower(during) > ${now}
    ORDER BY id`;
  return rows.map((row) => row.id);
}

export type SeriesOccurrenceRow = {
  id: string;
  status: string;
  start: Date;
  end: Date;
};

/** Every game of the series, oldest first (for the series sheet). */
export async function listSeriesOccurrences(tx: TenantTx, seriesId: string): Promise<SeriesOccurrenceRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ id: string; status: string; start: Date | string; end: Date | string }[]>`
    SELECT id, status::text AS status, lower(during) AS start, upper(during) AS end
    FROM "Booking"
    WHERE "seriesId" = ${seriesId} AND "tenantId" = ${tenantId}
    ORDER BY lower(during)`;
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    start: new Date(row.start),
    end: new Date(row.end),
  }));
}

export type BookingSeriesInfo = {
  bookingId: string;
  seriesId: string;
  anchor: SeriesAnchor;
  durationMinutes: number;
  /** APPROVED games of the series that have not started. */
  left: number;
  /** Start of the last APPROVED game of the series. */
  lastStart: Date | null;
};

/** The series (and its counters) of each of these bookings; bookings outside a series are absent. */
export async function listSeriesInfoForBookings(
  tx: TenantTx,
  bookingIds: readonly string[],
  now: Date,
): Promise<BookingSeriesInfo[]> {
  if (bookingIds.length === 0) return [];
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    {
      bookingId: string;
      seriesId: string;
      anchorDate: Date | string;
      anchorTime: string;
      durationMinutes: number;
      left: bigint;
      lastStart: Date | string | null;
    }[]
  >`
    SELECT b.id AS "bookingId", s.id AS "seriesId", s."anchorDate", s."anchorTime", s."durationMinutes",
      (SELECT COUNT(*) FROM "Booking" x
        WHERE x."seriesId" = s.id AND x."tenantId" = s."tenantId"
          AND x.status = 'APPROVED'::"BookingStatus" AND lower(x.during) > ${now}) AS "left",
      (SELECT MAX(lower(x.during)) FROM "Booking" x
        WHERE x."seriesId" = s.id AND x."tenantId" = s."tenantId"
          AND x.status = 'APPROVED'::"BookingStatus") AS "lastStart"
    FROM "Booking" b
    JOIN "BookingSeries" s ON s.id = b."seriesId"
    WHERE b."tenantId" = ${tenantId} AND b.id IN (${Prisma.join(bookingIds)})`;
  return rows.map((row) => {
    const [hour, minute] = row.anchorTime.split(":").map(Number);
    return {
      bookingId: row.bookingId,
      seriesId: row.seriesId,
      anchor: { date: civilOfDate(new Date(row.anchorDate)), hour: hour ?? 0, minute: minute ?? 0 },
      durationMinutes: row.durationMinutes,
      left: Number(row.left),
      lastStart: row.lastStart ? new Date(row.lastStart) : null,
    };
  });
}

export type ActiveSeriesRow = {
  seriesId: string;
  personId: string;
  personName: string;
  pitchId: string;
  pitchName: string;
  anchor: SeriesAnchor;
  durationMinutes: number;
  /** APPROVED games that have not started (always at least 1 here). */
  left: number;
  nextStart: Date;
  lastStart: Date;
};

/**
 * Series with at least one upcoming APPROVED game, soonest next game first. One aggregate query
 * (a lateral count per series). `personId` narrows it to one person (the person page).
 */
export async function listActiveSeries(tx: TenantTx, now: Date, personId?: string): Promise<ActiveSeriesRow[]> {
  const tenantId = await getCurrentTenantId();
  const onlyPerson = personId ? Prisma.sql`AND s."personId" = ${personId}` : Prisma.empty;
  const rows = await tx.$queryRaw<
    {
      seriesId: string;
      personId: string;
      personName: string;
      pitchId: string;
      pitchName: string;
      anchorDate: Date | string;
      anchorTime: string;
      durationMinutes: number;
      left: bigint;
      nextStart: Date | string;
      lastStart: Date | string;
    }[]
  >`
    SELECT s.id AS "seriesId", s."personId", per.name AS "personName", s."pitchId", p.name AS "pitchName",
      s."anchorDate", s."anchorTime", s."durationMinutes",
      u."left", u."nextStart", u."lastStart"
    FROM "BookingSeries" s
    JOIN "Person" per ON per.id = s."personId"
    JOIN "Pitch" p ON p.id = s."pitchId"
    JOIN LATERAL (
      SELECT COUNT(*) AS "left", MIN(lower(x.during)) AS "nextStart", MAX(lower(x.during)) AS "lastStart"
      FROM "Booking" x
      WHERE x."seriesId" = s.id AND x."tenantId" = s."tenantId"
        AND x.status = 'APPROVED'::"BookingStatus" AND lower(x.during) > ${now}
    ) u ON u."left" > 0
    WHERE s."tenantId" = ${tenantId} ${onlyPerson}
    ORDER BY u."nextStart" ASC, s.id ASC`;
  return rows.map((row) => {
    const [hour, minute] = row.anchorTime.split(":").map(Number);
    return {
      seriesId: row.seriesId,
      personId: row.personId,
      personName: row.personName,
      pitchId: row.pitchId,
      pitchName: row.pitchName,
      anchor: { date: civilOfDate(new Date(row.anchorDate)), hour: hour ?? 0, minute: minute ?? 0 },
      durationMinutes: row.durationMinutes,
      left: Number(row.left),
      nextStart: new Date(row.nextStart),
      lastStart: new Date(row.lastStart),
    };
  });
}
