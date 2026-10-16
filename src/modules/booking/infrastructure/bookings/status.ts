import { Prisma } from "@/generated/prisma/client";
import type { BookingStatus } from "@/generated/prisma/enums";
import { DomainError } from "@/lib/errors";
import type { TenantTx } from "@/lib/db";
import { getCurrentTenantId } from "@/lib/tenant-context";
import { formatUsd } from "@/lib/format/money";
import Decimal from "decimal.js";
import { refuseLbpGames } from "./_shared";

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
      AND "priceCurrency" = 'USD'::"Currency"
  `;
  if (count !== 1) {
    // An LBP game is not extended in dollars (DR-007 slice 8): say so instead of "not found".
    await refuseLbpGames(tx, Prisma.sql`b.id = ${input.bookingId}`, "setBookingEndAndPrice");
    throw new DomainError("booking.not_found");
  }
}
