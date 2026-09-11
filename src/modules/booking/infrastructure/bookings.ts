import { randomUUID } from "node:crypto";
import type { BookingStatus } from "@/app/generated/prisma/enums";
import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { formatUsd } from "@/lib/money";
import Decimal from "decimal.js";

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
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
  const id = randomUUID();
  const tenantId = await getCurrentTenantId();
  const price = formatUsd(input.priceUsd);

  await tx.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source", "priceUsd")
    VALUES (
      ${id},
      ${tenantId},
      ${input.pitchId},
      tstzrange(${input.start}, ${input.end}, '[)'),
      'PENDING'::"BookingStatus",
      'PUBLIC'::"BookingSource",
      ${price}::decimal
    )
  `;

  return id;
}

/**
 * Insert APPROVED/OWNER with during as tstzrange (SPEC-09).
 * Same raw insert as public PENDING — Client has no booking.create.
 * tenantId in SQL (extension does not stamp $executeRaw). Hits exclusion.
 */
export async function insertApprovedOwnerBooking(
  tx: TenantTx,
  input: { pitchId: string; start: Date; end: Date; priceUsd: Decimal },
): Promise<string> {
  const id = randomUUID();
  const tenantId = await getCurrentTenantId();
  const price = formatUsd(input.priceUsd);

  await tx.$executeRaw`
    INSERT INTO "Booking" ("id", "tenantId", "pitchId", "during", "status", "source", "priceUsd")
    VALUES (
      ${id},
      ${tenantId},
      ${input.pitchId},
      tstzrange(${input.start}, ${input.end}, '[)'),
      'APPROVED'::"BookingStatus",
      'OWNER'::"BookingSource",
      ${price}::decimal
    )
  `;

  return id;
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
  requesterName: string;
  requesterPhone: string;
};

type PendingSqlRow = {
  id: string;
  pitchId: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  requestedAt: Date | string;
  requesterName: string;
  requesterPhone: string;
};

/**
 * PENDING inbox for this tenant (guard / ALS). Oldest request first (BR-17).
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
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.status = 'PENDING'::"BookingStatus"
    ORDER BY b."requestedAt" ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    pitchId: row.pitchId,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    requestedAt: asDate(row.requestedAt),
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
  }));
}

export type BookingForDecision = {
  id: string;
  pitchId: string;
  status: BookingStatus;
  start: Date;
  end: Date;
};

type BookingSqlRow = {
  id: string;
  pitchId: string;
  status: BookingStatus;
  start: Date | string;
  end: Date | string;
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
      upper(during) AS end
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

export type ApprovedCollectRow = {
  id: string;
  pitchName: string;
  start: Date;
  end: Date;
  priceUsd: Decimal;
  requesterName: string;
  requesterPhone: string;
};

type ApprovedCollectSqlRow = {
  id: string;
  pitchName: string;
  start: Date | string;
  end: Date | string;
  priceUsd: Decimal | string;
  requesterName: string;
  requesterPhone: string;
};

/**
 * APPROVED games for the collect inbox. Soonest start first. Remaining is
 * computed in Booking application via Payment sums — no payment join here.
 */
export async function listApprovedBookingsForCollect(
  tx: TenantTx,
): Promise<ApprovedCollectRow[]> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<ApprovedCollectSqlRow[]>`
    SELECT
      b.id,
      p.name AS "pitchName",
      lower(b.during) AS start,
      upper(b.during) AS end,
      b."priceUsd",
      per.name AS "requesterName",
      per.phone AS "requesterPhone"
    FROM "Booking" b
    JOIN "Pitch" p ON p.id = b."pitchId"
    JOIN "BookingParticipant" bp ON bp."bookingId" = b.id AND bp."isRequester" = true
    JOIN "Person" per ON per.id = bp."personId"
    WHERE b."tenantId" = ${tenantId}
      AND b.status = 'APPROVED'::"BookingStatus"
    ORDER BY lower(b.during) ASC
  `;

  return rows.map((row) => ({
    id: row.id,
    pitchName: row.pitchName,
    start: asDate(row.start),
    end: asDate(row.end),
    priceUsd: new Decimal(row.priceUsd.toString()),
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
  }));
}

export type BookingForCollect = {
  id: string;
  status: BookingStatus;
  priceUsd: Decimal;
};

type BookingCollectSqlRow = {
  id: string;
  status: BookingStatus;
  priceUsd: Decimal | string;
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
    SELECT id, status, "priceUsd"
    FROM "Booking"
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId}
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    priceUsd: new Decimal(row.priceUsd.toString()),
  };
}
