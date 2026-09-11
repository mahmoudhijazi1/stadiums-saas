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
    throw new Error("Only a pending request can be approved or rejected");
  }
}

/**
 * Only APPROVED may be cancelled (BR-26). Domain, not Prisma.
 */
export function assertApprovedForCancel(status: BookingStatusLike): void {
  if (status !== "APPROVED") {
    throw new Error("Only a confirmed booking can be cancelled");
  }
}
