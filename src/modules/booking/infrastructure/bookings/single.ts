import type { BookingStatus } from "@/generated/prisma/enums";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import Decimal from "decimal.js";
import {
  dueChangeAmounts,
  gameDue,
  requireUsd,
  type GameCurrency,
  type GameMoney,
} from "@/modules/booking/domain/game-money";
import { asDate, BOOKING_MONEY_COLUMNS, BookingSqlRow, toBookingForDecision, type SqlMoney } from "./_shared";

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
      ${BOOKING_MONEY_COLUMNS},
      "collectionMode"::text AS "collectionMode"
    FROM "Booking"
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId}
  `;
  const row = rows[0];
  return row ? toBookingForDecision(row) : null;
}

/** A booking without its money: what a status-only decision (approve, reject) needs. */
export type BookingStatusRow = {
  id: string;
  pitchId: string;
  status: BookingStatus;
  start: Date;
  end: Date;
};

/**
 * One booking on this tenant, status and window only. Missing → null. Approve and reject only change
 * the status, so they read a game here in either currency (DR-007 slice 5); every money-changing use
 * case keeps `findBookingForDecision` / `findBookingForUpdate`, which refuse an LBP game.
 */
export async function findBookingStatus(
  tx: TenantTx,
  bookingId: string,
): Promise<BookingStatusRow | null> {
  const tenantId = await getCurrentTenantId();
  const rows = await tx.$queryRaw<{ id: string; pitchId: string; status: BookingStatus; start: Date | string; end: Date | string }[]>`
    SELECT id, "pitchId", status, lower(during) AS start, upper(during) AS end
    FROM "Booking"
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId}
  `;
  const row = rows[0];
  return row
    ? { id: row.id, pitchId: row.pitchId, status: row.status, start: asDate(row.start), end: asDate(row.end) }
    : null;
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
  priceCurrency: GameCurrency;
  amountDueUsd: SqlMoney;
  amountDueLbp: SqlMoney;
  collectedUsd: Decimal | string | null;
  requesterPersonId: string;
  requesterName: string;
  requesterPhone: string | null;
  dueNote: string | null;
  dueCurrency: GameCurrency | null;
  dueFromUsd: SqlMoney;
  dueToUsd: SqlMoney;
  dueFromLbp: SqlMoney;
  dueToLbp: SqlMoney;
};

/** The "to" amount of the latest due change, in its own currency. */
function latestDueTo(row: BookingFeeSqlRow, currency: GameCurrency): GameMoney {
  const change = dueChangeAmounts({
    currency,
    fromUsd: row.dueFromUsd,
    toUsd: row.dueToUsd,
    fromLbp: row.dueFromLbp,
    toLbp: row.dueToLbp,
  });
  return { currency: change.currency, amount: change.to };
}

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
      b."priceCurrency"::text AS "priceCurrency",
      b."amountDueUsd",
      b."amountDueLbp",
      COALESCE(collected.usd, 0) AS "collectedUsd",
      per.id AS "requesterPersonId",
      per.name AS "requesterName",
      per.phone AS "requesterPhone",
      latest.note AS "dueNote",
      latest."currency"::text AS "dueCurrency",
      latest."fromUsd" AS "dueFromUsd",
      latest."toUsd" AS "dueToUsd",
      latest."fromLbp" AS "dueFromLbp",
      latest."toLbp" AS "dueToLbp"
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
      SELECT d.note, d."currency", d."fromUsd", d."toUsd", d."fromLbp", d."toLbp"
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
    // An LBP game throws booking.lbp_not_supported: the WhatsApp fee text is in dollars (DR-007).
    amountDueUsd: requireUsd(gameDue(row), "fee-state.amountDueUsd"),
    collectedUsd: new Decimal((row.collectedUsd ?? 0).toString()),
    requesterPersonId: row.requesterPersonId,
    requesterName: row.requesterName,
    requesterPhone: row.requesterPhone,
    dueNote: row.dueNote,
    dueToUsd: row.dueCurrency ? requireUsd(latestDueTo(row, row.dueCurrency), "fee-state.dueToUsd") : null,
  };
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
