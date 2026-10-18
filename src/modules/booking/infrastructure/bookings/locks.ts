// Lock order for booking writes: the pitch row first (lockPitchForUpdate), then booking rows,
// several of them only through lockPendingRowsInOrder (one ORDER BY id statement).
// The table of every use case and its order is in docs/ARCHITECTURE.md, section 6 (Lock order).

import { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { BookingForDecision } from "./single";
import { BOOKING_MONEY_COLUMNS, BookingSqlRow, toBookingForDecision } from "./_shared";

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
 * Same read, holding the booking row until the transaction ends. A second tap on the
 * same slot waits here, then sees the slot already paid (SPEC-15 slice 2). The price and the due are
 * in the game's own currency (DR-007), so a cancel, a collect or an extension works on either.
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
      ${BOOKING_MONEY_COLUMNS},
      "collectionMode"::text AS "collectionMode"
    FROM "Booking"
    WHERE id = ${bookingId} AND "tenantId" = ${tenantId}
    FOR UPDATE
  `;
  const row = rows[0];
  return row ? toBookingForDecision(row) : null;
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
