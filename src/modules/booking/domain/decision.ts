import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";

/**
 * Only PENDING may be approved or rejected (BR-18). Domain, not Prisma.
 */
export type BookingStatusLike =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "NO_SHOW";

export function assertPendingForDecision(status: BookingStatusLike): void {
  if (status !== "PENDING") {
    throw new DomainError("booking.pending_only");
  }
}

/**
 * Only APPROVED may be cancelled (BR-26). Domain, not Prisma.
 */
export function assertApprovedForCancel(status: BookingStatusLike): void {
  if (status !== "APPROVED") {
    throw new DomainError("booking.confirmed_only");
  }
}

/** Past + still owed: Cancel would drop BR-49 debt. Future or remaining 0 is fine. */
export function isPastUnpaidCancel(
  start: Date,
  remaining: Decimal,
  now: Date,
): boolean {
  return start.getTime() <= now.getTime() && remaining.gt(0);
}

export function assertNotPastUnpaidCancel(input: {
  start: Date;
  remaining: Decimal;
  now: Date;
}): void {
  if (isPastUnpaidCancel(input.start, input.remaining, input.now)) {
    throw new DomainError("booking.cancel_past_unpaid");
  }
}
