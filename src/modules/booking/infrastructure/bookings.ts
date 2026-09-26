import { randomUUID } from "node:crypto";
import { Prisma } from "@/app/generated/prisma/client";
import type { BookingStatus } from "@/app/generated/prisma/enums";
import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { formatUsd } from "@/lib/money";
import Decimal from "decimal.js";

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

type BookingInsertStatus = "PENDING" | "APPROVED";
type BookingInsertSource = "PUBLIC" | "OWNER";

/**
 * Raw INSERT for Booking.during (Unsupported — no Client create).
 * tenantId in SQL — query extension does not stamp $executeRaw.
 * Callers keep fixed status/source pairs via the named exports below.
 */
async function insertBookingDuring(
  tx: TenantTx,
  input: { pitchId: string; start: Date; end: Date; priceUsd: Decimal },
  status: BookingInsertStatus,
  source: BookingInsertSource,
): Promise<string> {
  const id = randomUUID();
  const tenantId = await getCurrentTenantId();
  const price = formatUsd(input.priceUsd);

  await tx.$executeRaw`
    INSERT INTO "Booking" (
      "id", "tenantId", "pitchId", "during", "status", "source",
      "priceUsd", "amountDueUsd", "collectionMode"
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
      'WHOLE'::"CollectionMode"
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
  input: { pitchId: string; start: Date; end: Date; priceUsd: Decimal },
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
  input: { pitchId: string; start: Date; end: Date; priceUsd: Decimal },
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
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.status = 'PENDING'::"BookingStatus"
    ORDER BY lower(b.during) ASC, b."requestedAt" ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    requestedAt: asDate(row.requestedAt),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
  }));
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
  if (!row) return null;
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
export async function listApprovedRanges(
  tx: TenantTx,
  pitchId?: string,
): Promise<ApprovedRangeRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = pitchId
    ? await tx.$queryRaw<ApprovedSqlRow[]>`
        SELECT "pitchId", lower(during) AS start, upper(during) AS end
        FROM "Booking"
        WHERE "tenantId" = ${tenantId}
          AND status = 'APPROVED'::"BookingStatus"
          AND "pitchId" = ${pitchId}
      `
    : await tx.$queryRaw<ApprovedSqlRow[]>`
        SELECT "pitchId", lower(during) AS start, upper(during) AS end
        FROM "Booking"
        WHERE "tenantId" = ${tenantId}
          AND status = 'APPROVED'::"BookingStatus"
      `;

  return rows.map((row) => ({
    pitchId: row.pitchId,
    start: asDate(row.start),
    end: asDate(row.end),
  }));
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
      | "CORRECTION";
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
export async function listSlotInterestsWithPeople(
  tx: TenantTx,
): Promise<SlotInterestPersonRow[]> {
  const tenantId = await getCurrentTenantId();
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
    ORDER BY lower(si.during) ASC, si."createdAt" ASC
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

export type HomeCollectStatus = "APPROVED" | "NO_SHOW" | "CANCELLED";

export type ApprovedCollectRow = {
  id: string;
  status: HomeCollectStatus;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  amountDueUsd: Decimal;
  requesterName: string;
  requesterPhone: string;
};

type ApprovedCollectSqlRow = {
  id: string;
  status: HomeCollectStatus;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  priceUsd: Decimal | string;
  amountDueUsd: Decimal | string;
  requesterName: string;
  requesterPhone: string;
};

/**
 * APPROVED and unpaid-capable NO_SHOW rows for Home. Remaining is
 * computed in Booking application via Payment sums — no payment join here.
 */
function mapApprovedCollect(
  rows: ApprovedCollectSqlRow[],
): ApprovedCollectRow[] {
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: new Decimal(row.priceUsd.toString()),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
  }));
}

/** APPROVED / NO_SHOW / CANCELLED whose slot starts in `[from, to)` (UTC). */
export async function listApprovedBookingsInRange(
  tx: TenantTx,
  from: Date,
  to: Date,
): Promise<ApprovedCollectRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<ApprovedCollectSqlRow[]>`
    SELECT
      b.id,
      b.status,
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      b."amountDueUsd",
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.status IN (
        'APPROVED'::"BookingStatus",
        'NO_SHOW'::"BookingStatus",
        'CANCELLED'::"BookingStatus"
      )
      AND lower(b.during) >= ${from}
      AND lower(b.during) < ${to}
    ORDER BY lower(b.during) ASC
  `;
  return mapApprovedCollect(rows);
}

/** APPROVED / NO_SHOW / CANCELLED whose slot started before `before` (UTC). */
export async function listApprovedBookingsStartingBefore(
  tx: TenantTx,
  before: Date,
): Promise<ApprovedCollectRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<ApprovedCollectSqlRow[]>`
    SELECT
      b.id,
      b.status,
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      b."amountDueUsd",
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.status IN (
        'APPROVED'::"BookingStatus",
        'NO_SHOW'::"BookingStatus",
        'CANCELLED'::"BookingStatus"
      )
      AND lower(b.during) < ${before}
    ORDER BY lower(b.during) ASC
  `;
  return mapApprovedCollect(rows);
}

export type BookingForCollect = {
  id: string;
  status: BookingStatus;
  priceUsd: Decimal;
  amountDueUsd: Decimal;
};

type BookingCollectSqlRow = {
  id: string;
  status: BookingStatus;
  priceUsd: Decimal | string;
  amountDueUsd: Decimal | string;
};

/**
 * One booking for collect: status + price. Missing → null.
 */
export async function findBookingForCollect(
  tx: TenantTx,
  bookingId: string,
): Promise<BookingForCollect | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<BookingCollectSqlRow[]>`
    SELECT id, status, "priceUsd", "amountDueUsd"
    FROM "Booking"
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    priceUsd: new Decimal(row.priceUsd.toString()),
    amountDueUsd: new Decimal(row.amountDueUsd.toString()),
  };
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
  collectionMode: "WHOLE" | "PER_PLAYER";
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
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
  collectionMode: "WHOLE" | "PER_PLAYER";
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
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
    collectionMode: row.collectionMode,
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
  };
}

/**
 * APPROVED, CANCELLED, and NO_SHOW whose start falls in `[from, to)`.
 * `from`/`to` are the Beirut civil day's UTC bounds. Collected USD is the
 * sum of tenders, any collection date.
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
 * ended APPROVED, any NO_SHOW, any CANCELLED, each with due above collected.
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
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      b."amountDueUsd",
      b."collectionMode"::text AS "collectionMode",
      COALESCE(collected.usd, 0) AS "collectedUsd",
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
    WHERE b."tenantId" = ${tenantId}
      AND b."amountDueUsd" > collected.usd
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
