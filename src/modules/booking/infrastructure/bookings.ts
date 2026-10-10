import { randomUUID } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import type { BookingStatus } from "@/app/generated/prisma/enums";
import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { formatUsd } from "@/lib/money";
import Decimal from "decimal.js";
import {
  PENDING_INBOX_MISSED_MAX,
  PENDING_INBOX_UPCOMING_MAX,
} from "@/modules/booking/domain/pending-inbox";

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * What the players of a game still owe the shop: the sum, over its player tabs, of the tab total
 * minus what was paid on it (never below zero per tab). A tab is a sale put on the booking with a
 * payer; the "on the game" sale is part of the booking due instead and is not counted here.
 * Uses the alias `b` for the booking row.
 */
const TABS_REMAINING_SQL = Prisma.sql`COALESCE((
  SELECT SUM(GREATEST(tab.total - tab.paid, 0))
  FROM (
    SELECT
      (SELECT COALESCE(SUM(si."lineTotalUsd"), 0) FROM "SaleItem" si WHERE si."saleId" = s.id) AS total,
      (SELECT COALESCE(SUM(t."usdEquivalent"), 0)
         FROM "Payment" pay JOIN "PaymentTender" t ON t."paymentId" = pay.id
        WHERE pay."tenantId" = s."tenantId"
          AND pay."sourceType" = 'SALE'::"PaymentSourceType"
          AND pay."sourceId" = s.id) AS paid
    FROM "Sale" s
    WHERE s."bookingId" = b.id AND s."tenantId" = b."tenantId"
      AND (s."payerPersonId" IS NOT NULL OR s."payerName" IS NOT NULL)
  ) tab
), 0)`;

type BookingInsertStatus = "PENDING" | "APPROVED";
type BookingInsertSource = "PUBLIC" | "OWNER";

/**
 * Raw INSERT for Booking.during (Unsupported — no Client create).
 * tenantId in SQL — query extension does not stamp $executeRaw.
 * Callers keep fixed status/source pairs via the named exports below.
 */
async function insertBookingDuring(
  tx: TenantTx,
  input: {
    pitchId: string;
    start: Date;
    end: Date;
    priceUsd: Decimal;
    requestedName?: string | null;
    /** The weekly series this game belongs to (owner-created series only). */
    seriesId?: string | null;
  },
  status: BookingInsertStatus,
  source: BookingInsertSource,
): Promise<string> {
  const id = randomUUID();
  const tenantId = await getCurrentTenantId();
  const price = formatUsd(input.priceUsd);

  await tx.$executeRaw`
    INSERT INTO "Booking" (
      "id", "tenantId", "pitchId", "during", "status", "source",
      "priceUsd", "amountDueUsd", "collectionMode", "requestedName", "seriesId"
    )
    VALUES (
      ${id},
      ${tenantId},
      ${input.pitchId},
      tstzrange(${input.start}, ${input.end}, '[)'),
      ${status}::"BookingStatus",
      ${source}::"BookingSource",
      ${price}::decimal,
      ${price}::decimal,
      'WHOLE'::"CollectionMode",
      ${input.requestedName ?? null},
      ${input.seriesId ?? null}
    )
  `;

  return id;
}

/**
 * Insert PENDING/PUBLIC with during as tstzrange.
 * Prisma Client has no booking.create (required Unsupported). tenantId must be
 * in this SQL — the query extension does not stamp $executeRaw (SPEC-03 step 3).
 */
export async function insertPendingPublicBooking(
  tx: TenantTx,
  input: {
    pitchId: string;
    start: Date;
    end: Date;
    priceUsd: Decimal;
    /** Typed name when it differs from the stored Person name (S-6), else null. */
    requestedName?: string | null;
  },
): Promise<string> {
  return insertBookingDuring(tx, input, "PENDING", "PUBLIC");
}

/**
 * Serialize approved writes on one pitch (BR-24).
 * The second transaction waits here instead of deadlocking on the other booking row.
 * Raw SQL includes tenantId — the extension does not stamp $queryRaw.
 */
export async function lockPitchForUpdate(
  tx: TenantTx,
  pitchId: string,
): Promise<void> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Pitch"
    WHERE id = ${pitchId} AND "tenantId" = ${tenantId}
    FOR UPDATE
  `;
  if (!rows[0]) {
    throw new DomainError("booking.pitch_not_found");
  }
}

/**
 * Insert APPROVED/OWNER with during as tstzrange (SPEC-09).
 * Same raw insert as public PENDING — Client has no booking.create.
 * Hits exclusion when windows overlap another APPROVED.
 */
export async function insertApprovedOwnerBooking(
  tx: TenantTx,
  input: { pitchId: string; start: Date; end: Date; priceUsd: Decimal; seriesId?: string | null },
): Promise<string> {
  return insertBookingDuring(tx, input, "APPROVED", "OWNER");
}

/**
 * Requester row: whole game due on this person until split exists (SPEC-03).
 * Do not pass tenantId — the db extension stamps it (DR-001). Prisma 7’s
 * create XOR still requires tenantId (unchecked) or tenant (checked);
 * `$extends` does not rewrite those input types.
 */
export async function insertRequesterParticipant(
  tx: TenantTx,
  input: { bookingId: string; personId: string; amountDueUsd: Decimal },
) {
  return tx.bookingParticipant.create({
    data: {
      bookingId: input.bookingId,
      personId: input.personId,
      amountDueUsd: formatUsd(input.amountDueUsd),
      isRequester: true,
    } as Parameters<typeof tx.bookingParticipant.create>[0]["data"],
  });
}

export type PendingBookingRow = {
  id: string;
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  requestedAt: Date;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  /** Name typed on the request when it differs from requesterName (S-6). */
  requestedName: string | null;
};

type PendingSqlRow = {
  id: string;
  pitchId: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  requestedAt: Date | string;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  requestedName: string | null;
};

/**
 * PENDING inbox for this tenant (guard / ALS). Soonest slot first, then
 * oldest requestedAt (BR-17) inside an identical window.
 * during is raw — Prisma Client omits Unsupported on Booking.
 */
export async function listPendingBookings(
  tx: TenantTx,
): Promise<PendingBookingRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<PendingSqlRow[]>`
    SELECT
      b.id,
      b."pitchId",
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."requestedAt",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone",
      b."requestedName"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.status = 'PENDING'::"BookingStatus"
    ORDER BY lower(b.during) ASC, b."requestedAt" ASC
  `;

  return rows.map(mapPendingRow);
}

function mapPendingRow(row: PendingSqlRow): PendingBookingRow {
  return {
    id: row.id,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    requestedAt: asDate(row.requestedAt),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    requestedName: row.requestedName,
  };
}

/** Real totals behind the capped inbox (the caps are in domain/pending-inbox.ts). One query. */
export async function countPendingInboxTotals(
  tx: TenantTx,
  now: Date,
): Promise<{ upcoming: number; missed: number }> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ upcoming: bigint; missed: bigint }[]>`
    SELECT
      COUNT(*) FILTER (WHERE lower(b.during) > ${now})::bigint AS upcoming,
      COUNT(*) FILTER (WHERE lower(b.during) <= ${now})::bigint AS missed
    FROM "Booking" b
    WHERE b."tenantId" = ${tenantId} AND b.status = 'PENDING'::"BookingStatus"`;
  return { upcoming: Number(rows[0]?.upcoming ?? 0), missed: Number(rows[0]?.missed ?? 0) };
}

/**
 * The Requests inbox: the next 200 upcoming PENDING plus the 50 latest missed
 * ones, in start order. Approve and dismiss must see every row, so they keep
 * listPendingBookings.
 */
export async function listPendingInbox(
  tx: TenantTx,
  now: Date,
): Promise<PendingBookingRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<PendingSqlRow[]>`
    WITH picked AS (
      (SELECT b.id FROM "Booking" b
        WHERE b."tenantId" = ${tenantId}
          AND b.status = 'PENDING'::"BookingStatus"
          AND lower(b.during) > ${now}
        ORDER BY lower(b.during) ASC, b."requestedAt" ASC
        LIMIT ${PENDING_INBOX_UPCOMING_MAX})
      UNION ALL
      (SELECT b.id FROM "Booking" b
        WHERE b."tenantId" = ${tenantId}
          AND b.status = 'PENDING'::"BookingStatus"
          AND lower(b.during) <= ${now}
        ORDER BY lower(b.during) DESC, b."requestedAt" DESC
        LIMIT ${PENDING_INBOX_MISSED_MAX})
    )
    SELECT
      b.id,
      b."pitchId",
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."requestedAt",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone",
      b."requestedName"
    FROM picked
    JOIN "Booking" b ON b.id = picked.id AND b."tenantId" = ${tenantId}
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    ORDER BY lower(b.during) ASC, b."requestedAt" ASC
  `;
  return rows.map(mapPendingRow);
}

/**
 * One read for the live badge: actionable PENDING only (slot start still ahead).
 * tenantId is in the SQL — the extension does not stamp $queryRaw.
 */
export async function countActionablePending(
  tx: TenantTx,
  now: Date,
): Promise<{ pendingCount: number; latestRequestedAt: Date | null }> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { pendingCount: bigint; latestRequestedAt: Date | null }[]
  >`
    SELECT
      COUNT(*)::bigint AS "pendingCount",
      MAX(b."requestedAt") AS "latestRequestedAt"
    FROM "Booking" b
    WHERE b."tenantId" = ${tenantId}
      AND b.status = 'PENDING'::"BookingStatus"
      AND lower(b.during) > ${now}
  `;
  const row = rows[0];
  return {
    pendingCount: Number(row?.pendingCount ?? 0),
    latestRequestedAt: row?.latestRequestedAt
      ? asDate(row.latestRequestedAt)
      : null,
  };
}

export type BookingForDecision = {
  id: string;
  pitchId: string;
  status: BookingStatus;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  amountDueUsd: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
};

type BookingSqlRow = {
  id: string;
  pitchId: string;
  status: BookingStatus;
  start: Date | string;
  end: Date | string;
  priceUsd: Decimal | string;
  amountDueUsd: Decimal | string;
  collectionMode: "WHOLE" | "PER_PLAYER";
};

function toBookingForDecision(row: BookingSqlRow): BookingForDecision {
  return {
    id: row.id,
    pitchId: row.pitchId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: new Decimal(row.priceUsd.toString()),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectionMode: row.collectionMode,
  };
}

/**
 * One booking on this tenant, with during. Missing → null (wrong id or other stadium).
 */
export async function findBookingForDecision(
  tx: TenantTx,
  bookingId: string,
): Promise<BookingForDecision | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<BookingSqlRow[]>`
    SELECT
      id,
      "pitchId",
      status,
      lower(during) AS start,
      upper(during) AS end,
      "priceUsd",
      "amountDueUsd",
      "collectionMode"::text AS "collectionMode"
    FROM "Booking"
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId}
  `;
  const row = rows[0];
  return row ? toBookingForDecision(row) : null;
}

/**
 * Same read, holding the booking row until the transaction ends. A second tap on the
 * same slot waits here, then sees the slot already paid (SPEC-15 slice 2).
 */
export async function findBookingForUpdate(
  tx: TenantTx,
  bookingId: string,
): Promise<BookingForDecision | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<BookingSqlRow[]>`
    SELECT
      id,
      "pitchId",
      status,
      lower(during) AS start,
      upper(during) AS end,
      "priceUsd",
      "amountDueUsd",
      "collectionMode"::text AS "collectionMode"
    FROM "Booking"
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId}
    FOR UPDATE
  `;
  const row = rows[0];
  return row ? toBookingForDecision(row) : null;
}

export type BookingRequesterRow = {
  id: string;
  status: BookingStatus;
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
};

type BookingRequesterSqlRow = {
  id: string;
  status: BookingStatus;
  pitchId: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
};

/**
 * One booking plus its requester, any status. Missing → null.
 */
export async function findBookingRequester(
  tx: TenantTx,
  bookingId: string,
): Promise<BookingRequesterRow | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<BookingRequesterSqlRow[]>`
    SELECT
      b.id,
      b.status::text AS status,
      b."pitchId",
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b.id = ${bookingId} AND b."tenantId" = ${tenantId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
  };
}

export type BookingFeeState = {
  id: string;
  status: BookingStatus;
  pitchName: string;
  start: Date;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  dueNote: string | null;
  dueToUsd: Decimal | null;
};

type BookingFeeSqlRow = {
  id: string;
  status: BookingStatus;
  pitchName: string;
  start: Date | string;
  amountDueUsd: Decimal | string;
  collectedUsd: Decimal | string | null;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  dueNote: string | null;
  dueToUsd: Decimal | string | null;
};

/**
 * Saved due, collected, and the latest due-change note. Used to build a
 * WhatsApp body after cancel, no-show, or adjust — not from the form.
 */
export async function findBookingFeeState(
  tx: TenantTx,
  bookingId: string,
): Promise<BookingFeeState | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<BookingFeeSqlRow[]>`
    SELECT
      b.id,
      b.status::text AS status,
      p.name AS "pitchName",
      lower(b.during) AS start,
      b."amountDueUsd",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone",
      latest.note AS "dueNote",
      latest."toUsd" AS "dueToUsd"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
        AND pay."sourceId" = b.id
    ) collected ON true
    LEFT JOIN LATERAL (
      SELECT d.note, d."toUsd"
      FROM "BookingDueChange" d
      WHERE d."tenantId" = b."tenantId"
        AND d."bookingId" = b.id
      ORDER BY d."createdAt" DESC
      LIMIT 1
    ) latest ON true
    WHERE b.id = ${bookingId} AND b."tenantId" = ${tenantId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: asDate(row.start),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    dueNote: row.dueNote,
    dueToUsd:
      row.dueToUsd === null || row.dueToUsd === undefined
        ? null
        : new Decimal(row.dueToUsd.toString()),
  };
}

export type ApprovedRangeRow = {
  pitchId: string;
  start: Date;
  end: Date;
};

type ApprovedSqlRow = {
  pitchId: string;
  start: Date | string;
  end: Date | string;
};

/**
 * APPROVED windows for occupied (SPEC-05). Optional pitch filter.
 */
/** Occupancy and waitlist windows older than this are never needed (S-8). */
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * APPROVED windows ending after now − 24 h (security audit S-8: bounded by
 * time, not a row cap, so an overlap check never misses a future booking).
 * Every caller checks a slot that has not ended, or shows occupancy from today on.
 */
export async function listApprovedRanges(
  tx: TenantTx,
  pitchId?: string,
  now: Date = new Date(),
): Promise<ApprovedRangeRow[]> {
  const tenantId = await getCurrentTenantId();
  const since = new Date(now.getTime() - RECENT_WINDOW_MS);
  const rows = pitchId
    ? await tx.$queryRaw<ApprovedSqlRow[]>`
        SELECT "pitchId", lower(during) AS start, upper(during) AS end
        FROM "Booking"
        WHERE "tenantId" = ${tenantId}
          AND status = 'APPROVED'::"BookingStatus"
          AND "pitchId" = ${pitchId}
          AND upper(during) > ${since}
      `
    : await tx.$queryRaw<ApprovedSqlRow[]>`
        SELECT "pitchId", lower(during) AS start, upper(during) AS end
        FROM "Booking"
        WHERE "tenantId" = ${tenantId}
          AND status = 'APPROVED'::"BookingStatus"
          AND upper(during) > ${since}
      `;

  return rows.map((row) => ({
    pitchId: row.pitchId,
    start: asDate(row.start),
    end: asDate(row.end),
  }));
}

/**
 * PENDING requests per pitch and slot start inside [from, to), one grouped query
 * (Today free strip badge). Never a row per request, never one query per slot.
 */
export async function countPendingBySlot(
  tx: TenantTx,
  from: Date,
  to: Date,
): Promise<{ pitchId: string; start: Date; count: number }[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { pitchId: string; start: Date | string; count: bigint | number }[]
  >`
    SELECT "pitchId", lower(during) AS start, COUNT(*) AS count
    FROM "Booking"
    WHERE "tenantId" = ${tenantId}
      AND status = 'PENDING'::"BookingStatus"
      AND lower(during) >= ${from}
      AND lower(during) < ${to}
    GROUP BY "pitchId", lower(during)
  `;
  return rows.map((row) => ({
    pitchId: row.pitchId,
    start: asDate(row.start),
    count: Number(row.count),
  }));
}

/**
 * Lock these booking rows in one fixed order (by id) and return the ones still
 * PENDING. Every path that decides several pending rows ("They played", approve,
 * owner-create siblings, dismiss missed) locks through here first, so two of them can
 * never hold rows in opposite orders (audit: dismiss vs They played).
 */
export async function lockPendingRowsInOrder(
  tx: TenantTx,
  bookingIds: string[],
): Promise<Set<string>> {
  if (bookingIds.length === 0) return new Set();
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
    SELECT id, status::text AS status
    FROM "Booking"
    WHERE "tenantId" = ${tenantId}
      AND id IN (${Prisma.join(bookingIds)})
    ORDER BY id
    FOR UPDATE
  `;
  return new Set(rows.filter((row) => row.status === "PENDING").map((row) => row.id));
}

/**
 * PENDING → APPROVED or REJECTED. 0 rows means gone or already decided.
 */
export async function setPendingStatus(
  tx: TenantTx,
  bookingId: string,
  status: "APPROVED" | "REJECTED",
): Promise<void> {
  const result = await tx.booking.updateMany({
    where: { id: bookingId, status: "PENDING" },
    data: { status },
  });
  if (result.count !== 1) {
    throw new DomainError("booking.not_found");
  }
}

/**
 * APPROVED → CANCELLED. 0 rows means gone or not confirmed (SPEC-10).
 * Client updateMany on status exists (during is Unsupported; status is not).
 */
export async function setApprovedCancelled(
  tx: TenantTx,
  bookingId: string,
): Promise<void> {
  const result = await tx.booking.updateMany({
    where: { id: bookingId, status: "APPROVED" },
    data: { status: "CANCELLED" },
  });
  if (result.count !== 1) {
    throw new DomainError("booking.not_found");
  }
}

/**
 * APPROVED → NO_SHOW. 0 rows means gone or not confirmed (SPEC-14).
 */
export async function setApprovedNoShow(
  tx: TenantTx,
  bookingId: string,
): Promise<void> {
  const result = await tx.booking.updateMany({
    where: { id: bookingId, status: "APPROVED" },
    data: { status: "NO_SHOW" },
  });
  if (result.count !== 1) {
    throw new DomainError("booking.not_found");
  }
}

/**
 * Write Booking.amountDueUsd. A later change of collection mode, participants,
 * or participant dues must call this in the same transaction (SPEC-15).
 */
/**
 * Move the END of an APPROVED game and raise its agreed price, in one statement. The start and the
 * [) bounds are kept; tenantId is in the SQL (the extension does not stamp raw SQL). The caller
 * holds the pitch and booking locks. The exclusion constraint is the backstop: an overlap with
 * another APPROVED game raises 23P01 here.
 */
export async function setBookingEndAndPrice(
  tx: TenantTx,
  input: { bookingId: string; newEnd: Date; priceUsd: Decimal },
): Promise<void> {
  const tenantId = await getCurrentTenantId();
  const count = await tx.$executeRaw`
    UPDATE "Booking"
    SET during = tstzrange(lower(during), ${input.newEnd}, '[)'),
        "priceUsd" = ${formatUsd(input.priceUsd)}::numeric
    WHERE id = ${input.bookingId}
      AND "tenantId" = ${tenantId}
      AND status = 'APPROVED'::"BookingStatus"
  `;
  if (count !== 1) {
    throw new DomainError("booking.not_found");
  }
}

export async function setBookingAmountDue(
  tx: TenantTx,
  bookingId: string,
  amountDueUsd: Decimal,
): Promise<void> {
  const result = await tx.booking.updateMany({
    where: { id: bookingId },
    data: { amountDueUsd: formatUsd(amountDueUsd) },
  });
  if (result.count !== 1) {
    throw new DomainError("booking.not_found");
  }
}

/**
 * Append one due change. tenantId is stamped by the extension.
 * Written in the same transaction as Booking.amountDueUsd.
 */
export async function insertBookingDueChange(
  tx: TenantTx,
  input: {
    bookingId: string;
    fromUsd: Decimal;
    toUsd: Decimal;
    reason:
      | "LATE_CANCELLATION_FEE"
      | "NO_SHOW_FEE"
      | "CANCELLATION_NO_FEE"
      | "PARTIAL_GAME"
      | "DISCOUNT"
      | "WAIVER"
      | "CORRECTION"
      | "EXTENSION"
      | "SHOP_ITEMS";
    note: string | null;
    actorMembershipId: string;
  },
): Promise<void> {
  await tx.bookingDueChange.create({
    data: {
      bookingId: input.bookingId,
      fromUsd: formatUsd(input.fromUsd),
      toUsd: formatUsd(input.toUsd),
      reason: input.reason,
      note: input.note,
      actorMembershipId: input.actorMembershipId,
    } as Parameters<typeof tx.bookingDueChange.create>[0]["data"],
  });
}

/**
 * Requester person on this booking (for slot_interests). Guard scopes the participant.
 */
export async function findRequesterPersonId(
  tx: TenantTx,
  bookingId: string,
): Promise<string | null> {
  const row = await tx.bookingParticipant.findFirst({
    where: { bookingId, isRequester: true },
    select: { personId: true },
  });
  return row?.personId ?? null;
}

/**
 * Waitlist row for the approved window (DR-002 §2.13). Raw: no SlotInterest.create (Unsupported).
 */
export async function insertSlotInterest(
  tx: TenantTx,
  input: { pitchId: string; start: Date; end: Date; personId: string },
): Promise<void> {
  const tenantId = await getCurrentTenantId();
  await tx.$executeRaw`
    INSERT INTO "SlotInterest" ("id", "tenantId", "pitchId", "during", "personId")
    VALUES (
      ${randomUUID()},
      ${tenantId},
      ${input.pitchId},
      tstzrange(${input.start}, ${input.end}, '[)'),
      ${input.personId}
    )
  `;
}

/** Does this person already wait on exactly this window? (avoid a duplicate interest) */
export async function hasSlotInterest(
  tx: TenantTx,
  input: { pitchId: string; start: Date; end: Date; personId: string },
): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "SlotInterest"
    WHERE "tenantId" = ${tenantId}
      AND "pitchId" = ${input.pitchId}
      AND "personId" = ${input.personId}
      AND during = tstzrange(${input.start}, ${input.end}, '[)')
    LIMIT 1
  `;
  return rows.length > 0;
}

export type SlotInterestPersonRow = {
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  personId: string;
  name: string;
  phone: string;
  createdAt: Date;
};

type SlotInterestSqlRow = {
  pitchId: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  personId: string;
  name: string;
  phone: string;
  createdAt: Date | string;
};

/**
 * Waitlist rows for this tenant (SPEC-11). Raw: during is Unsupported.
 * tenantId in SQL (extension does not stamp $queryRaw). Open/closed is domain.
 */
export const SLOT_INTEREST_LIST_MAX = 500;

/** Interests on windows ending after now − 24 h, at most 500 (security audit S-8). */
export async function listSlotInterestsWithPeople(
  tx: TenantTx,
  now: Date = new Date(),
): Promise<SlotInterestPersonRow[]> {
  const tenantId = await getCurrentTenantId();
  const since = new Date(now.getTime() - RECENT_WINDOW_MS);
  const rows = await tx.$queryRaw<SlotInterestSqlRow[]>`
    SELECT
      si."pitchId",
      p.name AS "pitchName",
      lower(si.during) AS start,
      upper(si.during) AS end,
      si."personId",
      per.name,
      per.phone,
      si."createdAt"
    FROM "SlotInterest" si
    JOIN "Pitch" p ON p.id = si."pitchId"
    JOIN "Person" per ON per.id = si."personId"
    WHERE si."tenantId" = ${tenantId}
      AND upper(si.during) > ${since}
    ORDER BY lower(si.during) ASC, si."createdAt" ASC
    LIMIT ${SLOT_INTEREST_LIST_MAX}
  `;

  return rows.map((row) => ({
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    personId: row.personId,
    name: row.name,
    phone: row.phone,
    createdAt: asDate(row.createdAt),
  }));
}

export type LivePitchWindowRow = {
  start: Date;
  end: Date;
  status: "APPROVED" | "PENDING";
};

type LivePitchSqlRow = {
  start: Date | string;
  end: Date | string;
  status: "APPROVED" | "PENDING";
};

/**
 * Live APPROVED + PENDING on one pitch (hours-cover). Finished games
 * (`upper(during) <= now`) stay out of the query. Venue never imports this.
 */
export async function listLiveWindowsOnPitch(
  tx: TenantTx,
  pitchId: string,
  now: Date,
): Promise<LivePitchWindowRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<LivePitchSqlRow[]>`
    SELECT lower(during) AS start, upper(during) AS end, status
    FROM "Booking"
    WHERE "tenantId" = ${tenantId}
      AND "pitchId" = ${pitchId}
      AND status IN ('APPROVED'::"BookingStatus", 'PENDING'::"BookingStatus")
      AND upper(during) > ${now}
  `;
  return rows.map((row) => ({
    start: asDate(row.start),
    end: asDate(row.end),
    status: row.status,
  }));
}

export type DayBookingStatus = "APPROVED" | "CANCELLED" | "NO_SHOW";

export type DayBookingRow = {
  id: string;
  status: DayBookingStatus;
  pitchId: string;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  /** Unpaid player tabs on this game (shop items charged to a player). Never part of the booking due. */
  tabsRemainingUsd: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  pitchDefaultPlayerCount: number;
};

type DayBookingSqlRow = {
  id: string;
  status: DayBookingStatus;
  pitchId: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  priceUsd: Decimal | string;
  amountDueUsd: Decimal | string;
  collectedUsd: Decimal | string | null;
  tabsRemainingUsd: Decimal | string | null;
  collectionMode: "WHOLE" | "PER_PLAYER";
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  pitchDefaultPlayerCount: number;
};

function mapDayBooking(row: DayBookingSqlRow): DayBookingRow {
  return {
    id: row.id,
    status: row.status,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: new Decimal(row.priceUsd.toString()),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    tabsRemainingUsd: new Decimal((row.tabsRemainingUsd ?? 0).toString()),
    collectionMode: row.collectionMode,
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    pitchDefaultPlayerCount: row.pitchDefaultPlayerCount,
  };
}

/**
 * APPROVED, CANCELLED, and NO_SHOW whose start falls in `[from, to)`.
 * `from`/`to` are one business day's UTC bounds (`businessDayUtcRange`, 06:00 to 06:00
 * Beirut). Filtering on lower(during) keeps the ("tenantId", lower(during)) index.
 * Collected USD is the sum of tenders, any collection date.
 */
export async function listBookingsForStartDay(
  tx: TenantTx,
  from: Date,
  to: Date,
): Promise<DayBookingRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<DayBookingSqlRow[]>`
    SELECT
      b.id,
      b.status,
      b."pitchId",
      p.name AS "pitchName",
      p."defaultPlayerCount" AS "pitchDefaultPlayerCount",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      b."amountDueUsd",
      b."collectionMode"::text AS "collectionMode",
      COALESCE((
        SELECT SUM(t."usdEquivalent")
        FROM "Payment" pay
        JOIN "PaymentTender" t ON t."paymentId" = pay.id
        WHERE pay."tenantId" = b."tenantId"
          AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
          AND pay."sourceId" = b.id
      ), 0) AS "collectedUsd",
      ${TABS_REMAINING_SQL} AS "tabsRemainingUsd",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.status IN (
        'APPROVED'::"BookingStatus",
        'CANCELLED'::"BookingStatus",
        'NO_SHOW'::"BookingStatus"
      )
      AND lower(b.during) >= ${from}
      AND lower(b.during) < ${to}
    ORDER BY lower(b.during) ASC, b.id ASC
  `;
  return rows.map(mapDayBooking);
}

/**
 * Owed bookings, oldest start first. Same split as classifyDue:
 * ended APPROVED, any NO_SHOW, any CANCELLED, each with due above collected or an unpaid player tab.
 * `limit` includes one extra row so the caller can tell there is more.
 */
export async function listEndedWithRemaining(
  tx: TenantTx,
  now: Date,
  limit: number,
): Promise<DayBookingRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<DayBookingSqlRow[]>`
    SELECT
      b.id,
      b.status,
      b."pitchId",
      p.name AS "pitchName",
      p."defaultPlayerCount" AS "pitchDefaultPlayerCount",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      b."amountDueUsd",
      b."collectionMode"::text AS "collectionMode",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      tabs.usd AS "tabsRemainingUsd",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    JOIN LATERAL (
      SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
        AND pay."sourceId" = b.id
    ) collected ON true
    JOIN LATERAL (SELECT ${TABS_REMAINING_SQL} AS usd) tabs ON true
    WHERE b."tenantId" = ${tenantId}
      AND (b."amountDueUsd" > collected.usd OR tabs.usd > 0)
      AND (
        (
          b.status = 'APPROVED'::"BookingStatus"
          AND upper(b.during) <= ${now}
        )
        OR b.status IN (
          'NO_SHOW'::"BookingStatus",
          'CANCELLED'::"BookingStatus"
        )
      )
    ORDER BY lower(b.during) ASC, b.id ASC
    LIMIT ${limit}
  `;
  return rows.map(mapDayBooking);
}

export type PersonHistoryRow = {
  id: string;
  status: DayBookingStatus;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  participantDueUsd: Decimal;
  allocatedUsd: Decimal;
};

type PersonHistorySqlRow = {
  id: string;
  status: DayBookingStatus;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  priceUsd: Decimal | string;
  amountDueUsd: Decimal | string;
  collectedUsd: Decimal | string | null;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  participantDueUsd: Decimal | string;
  allocatedUsd: Decimal | string | null;
};

function mapPersonHistory(row: PersonHistorySqlRow): PersonHistoryRow {
  return {
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: new Decimal(row.priceUsd.toString()),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    collectionMode: row.collectionMode,
    isRequester: row.isRequester,
    participantDueUsd: new Decimal(row.participantDueUsd.toString()),
    allocatedUsd: new Decimal((row.allocatedUsd ?? 0).toString()),
  };
}

/**
 * Participations for one person, newest start first.
 * Keyset is (lower(during), booking id). `limit` includes one extra row.
 */
export async function listPersonBookingRows(
  tx: TenantTx,
  personId: string,
  cursor: { start: Date; id: string } | null,
  limit: number,
): Promise<PersonHistoryRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = cursor
    ? await tx.$queryRaw<PersonHistorySqlRow[]>`
        SELECT
          b.id,
          b.status,
          p.name AS "pitchName",
          lower(b.during) AS start,
          upper(b.during) AS end,
          b."priceUsd",
          b."amountDueUsd",
          b."collectionMode"::text AS "collectionMode",
          bp."isRequester",
          bp."amountDueUsd" AS "participantDueUsd",
          COALESCE(collected.usd, 0) AS "collectedUsd",
          COALESCE(alloc.usd, 0) AS "allocatedUsd"
        FROM "BookingParticipant" bp
        JOIN "Booking" b ON b.id = bp."bookingId"
        JOIN "Pitch" p ON p.id = b."pitchId"
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
          FROM "Payment" pay
          JOIN "PaymentTender" t ON t."paymentId" = pay.id
          WHERE pay."tenantId" = b."tenantId"
            AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
            AND pay."sourceId" = b.id
        ) collected ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd
          FROM "PaymentAllocation" a
          WHERE a."tenantId" = bp."tenantId"
            AND a."participantId" = bp.id
        ) alloc ON true
        WHERE bp."tenantId" = ${tenantId}
          AND bp."personId" = ${personId}
          AND b.status IN (
            'APPROVED'::"BookingStatus",
            'CANCELLED'::"BookingStatus",
            'NO_SHOW'::"BookingStatus"
          )
          AND (
            lower(b.during) < ${cursor.start}
            OR (lower(b.during) = ${cursor.start} AND b.id < ${cursor.id})
          )
        ORDER BY lower(b.during) DESC, b.id DESC
        LIMIT ${limit}
      `
    : await tx.$queryRaw<PersonHistorySqlRow[]>`
        SELECT
          b.id,
          b.status,
          p.name AS "pitchName",
          lower(b.during) AS start,
          upper(b.during) AS end,
          b."priceUsd",
          b."amountDueUsd",
          b."collectionMode"::text AS "collectionMode",
          bp."isRequester",
          bp."amountDueUsd" AS "participantDueUsd",
          COALESCE(collected.usd, 0) AS "collectedUsd",
          COALESCE(alloc.usd, 0) AS "allocatedUsd"
        FROM "BookingParticipant" bp
        JOIN "Booking" b ON b.id = bp."bookingId"
        JOIN "Pitch" p ON p.id = b."pitchId"
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
          FROM "Payment" pay
          JOIN "PaymentTender" t ON t."paymentId" = pay.id
          WHERE pay."tenantId" = b."tenantId"
            AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
            AND pay."sourceId" = b.id
        ) collected ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd
          FROM "PaymentAllocation" a
          WHERE a."tenantId" = bp."tenantId"
            AND a."participantId" = bp.id
        ) alloc ON true
        WHERE bp."tenantId" = ${tenantId}
          AND bp."personId" = ${personId}
          AND b.status IN (
            'APPROVED'::"BookingStatus",
            'CANCELLED'::"BookingStatus",
            'NO_SHOW'::"BookingStatus"
          )
        ORDER BY lower(b.during) DESC, b.id DESC
        LIMIT ${limit}
      `;
  return rows.map(mapPersonHistory);
}

/** Every participation used by person stats. One query, folded in domain. */
export async function listPersonStatRows(
  tx: TenantTx,
  personId: string,
): Promise<PersonHistoryRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<PersonHistorySqlRow[]>`
    SELECT
      b.id,
      b.status,
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      b."amountDueUsd",
      b."collectionMode"::text AS "collectionMode",
      bp."isRequester",
      bp."amountDueUsd" AS "participantDueUsd",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      COALESCE(alloc.usd, 0) AS "allocatedUsd"
    FROM "BookingParticipant" bp
    JOIN "Booking" b ON b.id = bp."bookingId"
    JOIN "Pitch" p ON p.id = b."pitchId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
        AND pay."sourceId" = b.id
    ) collected ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd
      FROM "PaymentAllocation" a
      WHERE a."tenantId" = bp."tenantId"
        AND a."participantId" = bp.id
    ) alloc ON true
    WHERE bp."tenantId" = ${tenantId}
      AND bp."personId" = ${personId}
      AND b.status IN (
        'APPROVED'::"BookingStatus",
        'CANCELLED'::"BookingStatus",
        'NO_SHOW'::"BookingStatus"
      )
  `;
  return rows.map(mapPersonHistory);
}

export type DebtParticipationSqlRow = {
  personId: string;
  bookingId: string;
  status: "APPROVED" | "CANCELLED" | "NO_SHOW";
  start: Date;
  end: Date;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  participantDueUsd: Decimal;
  allocatedUsd: Decimal;
  reason: string | null;
};

type DebtParticipationRaw = {
  personId: string;
  bookingId: string;
  status: "APPROVED" | "CANCELLED" | "NO_SHOW";
  start: Date | string;
  end: Date | string;
  collectionMode: "WHOLE" | "PER_PLAYER";
  isRequester: boolean;
  amountDueUsd: Decimal | string;
  collectedUsd: Decimal | string | null;
  participantDueUsd: Decimal | string;
  allocatedUsd: Decimal | string | null;
  reason: string | null;
};

/**
 * Participations for many people, one query. Latest due-change reason rides along.
 * Caller passes the person ids on this screen. Empty list does not hit the database.
 */
export async function listDebtParticipations(
  tx: TenantTx,
  personIds: string[],
): Promise<DebtParticipationSqlRow[]> {
  if (personIds.length === 0) return [];
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<DebtParticipationRaw[]>`
    SELECT
      bp."personId",
      b.id AS "bookingId",
      b.status::text AS status,
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."collectionMode"::text AS "collectionMode",
      bp."isRequester",
      b."amountDueUsd",
      bp."amountDueUsd" AS "participantDueUsd",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      COALESCE(alloc.usd, 0) AS "allocatedUsd",
      latest.reason::text AS reason
    FROM "BookingParticipant" bp
    JOIN "Booking" b ON b.id = bp."bookingId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
        AND pay."sourceId" = b.id
    ) collected ON true
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd
      FROM "PaymentAllocation" a
      WHERE a."tenantId" = bp."tenantId"
        AND a."participantId" = bp.id
    ) alloc ON true
    LEFT JOIN LATERAL (
      SELECT d.reason
      FROM "BookingDueChange" d
      WHERE d."tenantId" = b."tenantId"
        AND d."bookingId" = b.id
      ORDER BY d."createdAt" DESC
      LIMIT 1
    ) latest ON true
    WHERE bp."tenantId" = ${tenantId}
      AND bp."personId" IN (${Prisma.join(personIds)})
      AND bp."personId" IS NOT NULL
      AND b.status IN (
        'APPROVED'::"BookingStatus",
        'CANCELLED'::"BookingStatus",
        'NO_SHOW'::"BookingStatus"
      )
  `;
  return rows.map((row) => ({
    personId: row.personId,
    bookingId: row.bookingId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    collectionMode: row.collectionMode,
    isRequester: row.isRequester,
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    participantDueUsd: new Decimal(row.participantDueUsd.toString()),
    allocatedUsd: new Decimal((row.allocatedUsd ?? 0).toString()),
    reason: row.reason,
  }));
}

/** How many allocations sit on this booking's participants. Zero allows switching back. */
export async function countBookingAllocations(
  tx: TenantTx,
  bookingId: string,
): Promise<number> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*)::bigint AS n
    FROM "PaymentAllocation" a
    JOIN "BookingParticipant" bp ON bp.id = a."participantId"
    WHERE bp."bookingId" = ${bookingId}
      AND bp."tenantId" = ${tenantId}
      AND a."tenantId" = ${tenantId}
  `;
  return Number(rows[0]?.n ?? 0);
}

async function setCollectionMode(
  tx: TenantTx,
  bookingId: string,
  mode: "WHOLE" | "PER_PLAYER",
): Promise<void> {
  const tenantId = await getCurrentTenantId();
  await tx.$executeRaw`
    UPDATE "Booking"
    SET "collectionMode" = ${mode}::"CollectionMode"
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId}
  `;
}

/**
 * WHOLE → PER_PLAYER. The requester row becomes slot 1; slots 2..N are new unnamed rows.
 * Booking.amountDueUsd is untouched: the shares add up to it exactly.
 */
export async function applyPerPlayerSlots(
  tx: TenantTx,
  input: {
    bookingId: string;
    slots: { slotNumber: number; amountDueUsd: Decimal; isRequester: boolean }[];
  },
): Promise<void> {
  for (const slot of input.slots) {
    if (slot.isRequester) {
      const updated = await tx.bookingParticipant.updateMany({
        where: { bookingId: input.bookingId, isRequester: true },
        data: {
          slotNumber: slot.slotNumber,
          amountDueUsd: formatUsd(slot.amountDueUsd),
        },
      });
      if (updated.count !== 1) {
        throw new DomainError("booking.not_found");
      }
    }
  }
  for (const slot of input.slots) {
    if (slot.isRequester) continue;
    await tx.bookingParticipant.create({
      data: {
        bookingId: input.bookingId,
        personId: null,
        amountDueUsd: formatUsd(slot.amountDueUsd),
        slotNumber: slot.slotNumber,
        isRequester: false,
      } as Parameters<typeof tx.bookingParticipant.create>[0]["data"],
    });
  }
  await setCollectionMode(tx, input.bookingId, "PER_PLAYER");
}

/**
 * PER_PLAYER → WHOLE. Callers have checked there are no allocations, so deleting the
 * non-requester rows loses nothing. The requester carries the whole due again.
 */
export async function applyWholeMode(
  tx: TenantTx,
  input: { bookingId: string; amountDueUsd: Decimal },
): Promise<void> {
  await tx.bookingParticipant.deleteMany({
    where: { bookingId: input.bookingId, isRequester: false },
  });
  await tx.bookingParticipant.updateMany({
    where: { bookingId: input.bookingId, isRequester: true },
    data: { slotNumber: null, amountDueUsd: formatUsd(input.amountDueUsd) },
  });
  await setCollectionMode(tx, input.bookingId, "WHOLE");
}

/**
 * Cancel-with-payments only: drop the per-player structure, allocations included, and
 * put the booking back to WHOLE. The payments, tenders and ledger rows stay; only who
 * paid what (the allocations) is lost. Everything collected keeps counting on the booking.
 * Same transaction as the cancel (SPEC-15 slice 2).
 */
export async function collapseToWhole(
  tx: TenantTx,
  input: { bookingId: string; amountDueUsd: Decimal },
): Promise<void> {
  await tx.paymentAllocation.deleteMany({
    where: { participant: { bookingId: input.bookingId } },
  });
  await applyWholeMode(tx, input);
}

export type SlotRow = {
  bookingId: string;
  participantId: string;
  slotNumber: number;
  isRequester: boolean;
  personId: string | null;
  name: string | null;
  dueUsd: Decimal;
  paidUsd: Decimal;
};

type SlotSqlRow = {
  bookingId: string;
  participantId: string;
  slotNumber: number;
  isRequester: boolean;
  personId: string | null;
  name: string | null;
  dueUsd: Decimal | string;
  paidUsd: Decimal | string | null;
};

/**
 * Slots (participants with a slot number) for these bookings, in slot order,
 * each with what its allocations add up to.
 */
export async function listSlotsForBookings(
  tx: TenantTx,
  bookingIds: string[],
): Promise<SlotRow[]> {
  if (bookingIds.length === 0) return [];
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<SlotSqlRow[]>`
    SELECT
      bp."bookingId" AS "bookingId",
      bp.id AS "participantId",
      bp."slotNumber" AS "slotNumber",
      bp."isRequester" AS "isRequester",
      bp."personId" AS "personId",
      per.name AS name,
      bp."amountDueUsd" AS "dueUsd",
      COALESCE((
        SELECT SUM(a."amountUsd")
        FROM "PaymentAllocation" a
        WHERE a."participantId" = bp.id AND a."tenantId" = bp."tenantId"
      ), 0) AS "paidUsd"
    FROM "BookingParticipant" bp
    LEFT JOIN "Person" per ON per.id = bp."personId"
    WHERE bp."tenantId" = ${tenantId}
      AND bp."bookingId" IN (${Prisma.join(bookingIds)})
      AND bp."slotNumber" IS NOT NULL
    ORDER BY bp."bookingId" ASC, bp."slotNumber" ASC
  `;
  return rows.map((row) => ({
    bookingId: row.bookingId,
    participantId: row.participantId,
    slotNumber: row.slotNumber,
    isRequester: row.isRequester,
    personId: row.personId,
    name: row.name,
    dueUsd: new Decimal(row.dueUsd.toString()),
    paidUsd: new Decimal((row.paidUsd ?? 0).toString()),
  }));
}

/** Future PENDING requests where this person is the requester (public request cap, S-5). */
export async function countFuturePendingForRequester(
  tx: TenantTx,
  personId: string,
  now: Date,
): Promise<number> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM "Booking" b
    JOIN "BookingParticipant" p ON p."bookingId" = b.id AND p."isRequester"
    WHERE b."tenantId" = ${tenantId}
      AND b.status = 'PENDING'
      AND p."personId" = ${personId}
      AND lower(b.during) > ${now}
  `;
  return Number(rows[0]?.n ?? 0);
}

export type BookingLabelRow = {
  id: string;
  start: Date;
  personId: string | null;
  requesterName: string | null;
};

/** The requester of many bookings, one query. For labels (Money activity), not for money. */
export async function listBookingLabelRows(
  tx: TenantTx,
  bookingIds: string[],
): Promise<BookingLabelRow[]> {
  if (bookingIds.length === 0) return [];
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    { id: string; start: Date | string; personId: string | null; name: string | null }[]
  >`
    SELECT b.id, lower(b.during) AS start, per.id AS "personId", per.name
    FROM "Booking" b
    LEFT JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    LEFT JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.id IN (${Prisma.join(bookingIds)})
  `;
  return rows.map((row) => ({
    id: row.id,
    start: asDate(row.start),
    personId: row.personId,
    requesterName: row.name,
  }));
}

export type OwedParticipationSqlRow = {
  bookingId: string;
  status: string;
  start: Date;
  end: Date;
  collectionMode: string;
  pitchName: string;
  personId: string | null;
  personName: string | null;
  personPhone: string | null;
  isRequester: boolean;
  amountDueUsd: Decimal;
  collectedUsd: Decimal;
  participantDueUsd: Decimal;
  allocatedUsd: Decimal;
};

/**
 * Every participant of every booking with money still due (an ended approved game, any
 * no-show, any cancelled fee), one query and no per-person lookups. Slots with no person
 * come through with a null personId. The caller classifies and groups.
 */
export async function listOwedParticipations(
  tx: TenantTx,
  now: Date,
): Promise<OwedParticipationSqlRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    {
      bookingId: string;
      status: string;
      start: Date | string;
      end: Date | string;
      collectionMode: string;
      pitchName: string;
      personId: string | null;
      personName: string | null;
      personPhone: string | null;
      isRequester: boolean;
      amountDueUsd: { toString(): string };
      collectedUsd: { toString(): string } | null;
      participantDueUsd: { toString(): string };
      allocatedUsd: { toString(): string } | null;
    }[]
  >`
    SELECT
      b.id AS "bookingId",
      b.status::text AS status,
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."collectionMode"::text AS "collectionMode",
      p.name AS "pitchName",
      bp."personId",
      per.name AS "personName",
      per.phone AS "personPhone",
      bp."isRequester",
      b."amountDueUsd",
      collected.usd AS "collectedUsd",
      bp."amountDueUsd" AS "participantDueUsd",
      alloc.usd AS "allocatedUsd"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN LATERAL (
      SELECT COALESCE(SUM(t."usdEquivalent"), 0) AS usd
      FROM "Payment" pay
      JOIN "PaymentTender" t ON t."paymentId" = pay.id
      WHERE pay."tenantId" = b."tenantId"
        AND pay."sourceType" = 'BOOKING'::"PaymentSourceType"
        AND pay."sourceId" = b.id
    ) collected ON true
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."tenantId" = b."tenantId"
    LEFT JOIN "Person" per ON per.id = bp."personId"
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(a."amountUsd"), 0) AS usd
      FROM "PaymentAllocation" a
      WHERE a."tenantId" = bp."tenantId"
        AND a."participantId" = bp.id
    ) alloc ON true
    WHERE b."tenantId" = ${tenantId}
      AND b."amountDueUsd" > collected.usd
      AND (
        (b.status = 'APPROVED'::"BookingStatus" AND upper(b.during) <= ${now})
        OR b.status IN ('NO_SHOW'::"BookingStatus", 'CANCELLED'::"BookingStatus")
      )
    ORDER BY lower(b.during) DESC, b.id DESC, bp."slotNumber" ASC NULLS FIRST
  `;
  return rows.map((row) => ({
    bookingId: row.bookingId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    collectionMode: row.collectionMode,
    pitchName: row.pitchName,
    personId: row.personId,
    personName: row.personName,
    personPhone: row.personPhone,
    isRequester: row.isRequester,
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    participantDueUsd: new Decimal(row.participantDueUsd.toString()),
    allocatedUsd: new Decimal((row.allocatedUsd ?? 0).toString()),
  }));
}

export type OwedTabSqlRow = {
  saleId: string;
  bookingId: string;
  status: string;
  start: Date;
  end: Date;
  pitchName: string;
  /** Null when the tab was opened under a typed name. */
  personId: string | null;
  name: string;
  phone: string | null;
  remainingUsd: Decimal;
};

/**
 * Every unpaid player tab on a game that is owed (an ended approved game, any no-show, any
 * cancelled booking): one query. A tab is never part of the booking due, so the other owed reads
 * do not see it; the owed summary adds these rows.
 */
export async function listOwedTabs(tx: TenantTx, now: Date): Promise<OwedTabSqlRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<
    {
      saleId: string;
      bookingId: string;
      status: string;
      start: Date | string;
      end: Date | string;
      pitchName: string;
      personId: string | null;
      name: string;
      phone: string | null;
      remainingUsd: { toString(): string };
    }[]
  >`
    SELECT
      s.id AS "saleId",
      b.id AS "bookingId",
      b.status::text AS status,
      lower(b.during) AS start,
      upper(b.during) AS end,
      p.name AS "pitchName",
      s."payerPersonId" AS "personId",
      COALESCE(per.name, s."payerName") AS name,
      COALESCE(per.phone, s."payerPhone") AS phone,
      (tab.total - tab.paid) AS "remainingUsd"
    FROM "Sale" s
    JOIN "Booking" b ON b.id = s."bookingId"
    JOIN "Pitch" p ON p.id = b."pitchId"
    LEFT JOIN "Person" per ON per.id = s."payerPersonId"
    JOIN LATERAL (
      SELECT
        (SELECT COALESCE(SUM(si."lineTotalUsd"), 0) FROM "SaleItem" si WHERE si."saleId" = s.id) AS total,
        (SELECT COALESCE(SUM(t."usdEquivalent"), 0)
           FROM "Payment" pay JOIN "PaymentTender" t ON t."paymentId" = pay.id
          WHERE pay."tenantId" = s."tenantId"
            AND pay."sourceType" = 'SALE'::"PaymentSourceType"
            AND pay."sourceId" = s.id) AS paid
    ) tab ON true
    WHERE s."tenantId" = ${tenantId}
      AND (s."payerPersonId" IS NOT NULL OR s."payerName" IS NOT NULL)
      AND tab.total - tab.paid > 0
      AND (
        (b.status = 'APPROVED'::"BookingStatus" AND upper(b.during) <= ${now})
        OR b.status IN ('NO_SHOW'::"BookingStatus", 'CANCELLED'::"BookingStatus")
      )
    ORDER BY lower(b.during) DESC, s.id DESC
  `;
  return rows.map((row) => ({
    saleId: row.saleId,
    bookingId: row.bookingId,
    status: row.status,
    start: asDate(row.start),
    end: asDate(row.end),
    pitchName: row.pitchName,
    personId: row.personId,
    name: row.name,
    phone: row.phone,
    remainingUsd: new Decimal(row.remainingUsd.toString()),
  }));
}
