import { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { formatUsd } from "@/lib/format/money";
import Decimal from "decimal.js";
import { requireUsd, type GameCurrency } from "@/modules/booking/domain/game-money";
import { shareOwing } from "@/modules/booking/domain/game-owing";
import type { SqlMoney } from "./_shared";

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
  /** The game's currency; `due` and `paid` are in it (DR-007). */
  currency: GameCurrency;
  due: Decimal;
  paid: Decimal;
};

/** A slot of a USD game, as the dollar slot charging (a money write) reads it. */
export type UsdSlotRow = Omit<SlotRow, "currency" | "due" | "paid"> & { dueUsd: Decimal; paidUsd: Decimal };

type SlotSqlRow = {
  bookingId: string;
  priceCurrency: GameCurrency;
  participantId: string;
  slotNumber: number;
  isRequester: boolean;
  personId: string | null;
  name: string | null;
  dueUsd: SqlMoney;
  dueLbp: SqlMoney;
  paidUsd: SqlMoney;
  paidLbp: SqlMoney;
};

/**
 * Slots (participants with a slot number) for these bookings, in slot order,
 * each with what its allocations add up to, in its game's currency (DR-007: pounds for an LBP game).
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
      b."priceCurrency"::text AS "priceCurrency",
      bp.id AS "participantId",
      bp."slotNumber" AS "slotNumber",
      bp."isRequester" AS "isRequester",
      bp."personId" AS "personId",
      per.name AS name,
      bp."amountDueUsd" AS "dueUsd",
      bp."amountDueLbp" AS "dueLbp",
      COALESCE((
        SELECT SUM(a."amountUsd")
        FROM "PaymentAllocation" a
        WHERE a."participantId" = bp.id AND a."tenantId" = bp."tenantId"
      ), 0) AS "paidUsd",
      COALESCE((
        SELECT SUM(a."amountLbp")
        FROM "PaymentAllocation" a
        WHERE a."participantId" = bp.id AND a."tenantId" = bp."tenantId"
      ), 0) AS "paidLbp"
    FROM "BookingParticipant" bp
    JOIN "Booking" b ON b.id = bp."bookingId" AND b."tenantId" = bp."tenantId"
    LEFT JOIN "Person" per ON per.id = bp."personId"
    WHERE bp."tenantId" = ${tenantId}
      AND bp."bookingId" IN (${Prisma.join(bookingIds)})
      AND bp."slotNumber" IS NOT NULL
    ORDER BY bp."bookingId" ASC, bp."slotNumber" ASC
  `;
  return rows.map((row) => {
    const share = shareOwing({
      currency: row.priceCurrency,
      amountDueUsd: row.dueUsd,
      amountDueLbp: row.dueLbp,
      allocatedUsd: row.paidUsd,
      allocatedLbp: row.paidLbp,
      where: "slots",
    });
    return {
      bookingId: row.bookingId,
      participantId: row.participantId,
      slotNumber: row.slotNumber,
      isRequester: row.isRequester,
      personId: row.personId,
      name: row.name,
      currency: share.currency,
      due: share.due,
      paid: share.allocated,
    };
  });
}

/**
 * The same slots as dollars, for slot charging (a money write, USD only until DR-007 slice 7): a slot
 * of an LBP game is refused with `booking.lbp_not_supported`.
 */
export function usdSlots(slots: readonly SlotRow[]): UsdSlotRow[] {
  return slots.map(({ currency, due, paid, ...rest }) => ({
    ...rest,
    dueUsd: requireUsd({ currency, amount: due }, "slots.dueUsd"),
    paidUsd: requireUsd({ currency, amount: paid }, "slots.paidUsd"),
  }));
}
