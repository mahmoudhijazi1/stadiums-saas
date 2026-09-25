import Decimal from "decimal.js";

export type CollectionModeName = "WHOLE" | "PER_PLAYER";

/**
 * What one person still owes on a booking.
 * WHOLE: the booking remaining sits on the requester; everyone else owes 0.
 * PER_PLAYER: that participant's own remaining.
 */
export function personOwedOnBooking(input: {
  collectionMode: CollectionModeName;
  isRequester: boolean;
  bookingRemainingUsd: Decimal;
  participantRemainingUsd: Decimal;
}): Decimal {
  if (input.collectionMode === "WHOLE") {
    return input.isRequester ? input.bookingRemainingUsd : new Decimal(0);
  }
  return input.participantRemainingUsd;
}

/**
 * USD already collected that counts as this person's paid total.
 * WHOLE: the booking's tenders sit on the requester. PER_PLAYER: allocations.
 */
export function personPaidOnBooking(input: {
  collectionMode: CollectionModeName;
  isRequester: boolean;
  collectedUsd: Decimal;
  allocatedUsd: Decimal;
}): Decimal {
  if (input.collectionMode === "WHOLE") {
    return input.isRequester ? input.collectedUsd : new Decimal(0);
  }
  return input.allocatedUsd;
}
