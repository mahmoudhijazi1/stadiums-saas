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
 * BR-26 "at any time" is read as "any time before the game starts":
 * see isCancelWindowClosed.
 */
export function assertApprovedForCancel(status: BookingStatusLike): void {
  if (status !== "APPROVED") {
    throw new DomainError("booking.confirmed_only");
  }
}

/**
 * Cancel means the game will not happen, so it ends when the game starts, paid or
 * not. After that the owner records a no-show if it did not happen (BR-22).
 */
export function isCancelWindowClosed(start: Date, now: Date): boolean {
  return start.getTime() <= now.getTime();
}

export function assertCancelWindowOpen(input: { start: Date; now: Date }): void {
  if (isCancelWindowClosed(input.start, input.now)) {
    throw new DomainError("booking.cancel_started");
  }
}

/**
 * Only APPROVED may become NO_SHOW (BR-22). Domain, not Prisma.
 */
export function assertApprovedForNoShow(status: BookingStatusLike): void {
  if (status !== "APPROVED") {
    throw new DomainError("booking.no_show_only_approved");
  }
}

/** Hour finished: no-show is not for a future or in-progress window. */
export function isNoShowWindowEnded(end: Date, now: Date): boolean {
  return end.getTime() <= now.getTime();
}

export function assertEndedForNoShow(input: { end: Date; now: Date }): void {
  if (!isNoShowWindowEnded(input.end, input.now)) {
    throw new DomainError("booking.no_show_not_ended");
  }
}
