import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";
import type { CollectionModeName } from "@/modules/booking/domain/person-owed";

/**
 * May this booking go WHOLE → PER_PLAYER? Only an APPROVED game with something due.
 * CANCELLED and NO_SHOW dues are fees, not a share of the pitch price (SPEC-16).
 */
export function assertCanSwitchToPerPlayer(input: {
  status: string;
  collectionMode: CollectionModeName;
  amountDueUsd: Decimal;
  allocationCount: number;
}): void {
  if (input.status === "CANCELLED" || input.status === "NO_SHOW") {
    throw new DomainError("booking.switch_fee_booking");
  }
  if (input.status !== "APPROVED") {
    throw new DomainError("booking.switch_not_approved");
  }
  if (input.collectionMode !== "WHOLE" || input.allocationCount > 0) {
    throw new DomainError("booking.switch_not_whole");
  }
  if (input.amountDueUsd.lte(0)) {
    throw new DomainError("booking.switch_no_due");
  }
}

/**
 * May this booking go PER_PLAYER → WHOLE? Only while nobody has been credited,
 * otherwise who paid what would be lost.
 */
export function assertCanSwitchToWhole(input: {
  collectionMode: CollectionModeName;
  allocationCount: number;
}): void {
  if (input.collectionMode !== "PER_PLAYER") {
    throw new DomainError("booking.switch_not_per_player");
  }
  if (input.allocationCount > 0) {
    throw new DomainError("booking.switch_has_allocations");
  }
}

/**
 * May this slot tap (or pay-all) take a payment? Needs an APPROVED booking in
 * PER_PLAYER mode and a positive charge from `planSlotCharge`, which is already capped
 * at the booking remaining (Unassigned included). Cancel and no-show collapse the
 * booking to WHOLE first, so a per-player booking is never in another status.
 */
export function assertCanPaySlot(input: {
  status: string;
  collectionMode: CollectionModeName;
  chargeUsd: Decimal;
}): void {
  if (input.collectionMode !== "PER_PLAYER") {
    throw new DomainError("booking.switch_not_per_player");
  }
  if (input.status !== "APPROVED") {
    throw new DomainError("payment.collect_unapproved");
  }
  if (input.chargeUsd.lte(0)) {
    throw new DomainError("payment.nothing_due");
  }
}
