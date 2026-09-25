import Decimal from "decimal.js";
import { DomainError } from "@/lib/errors";

/**
 * Split a USD amount into n cent shares. The first leftover cents get one extra cent.
 * Money stays Decimal. n is a count, not a money amount.
 */
export function splitEvenly(amountUsd: Decimal, n: number): Decimal[] {
  if (!Number.isInteger(n) || n < 1) {
    throw new DomainError("booking.split_count");
  }

  const totalCents = amountUsd.times(100);
  const base = totalCents.dividedBy(n).floor();
  let extra = totalCents.minus(base.times(n));
  const shares: Decimal[] = [];

  for (let i = 0; i < n; i++) {
    const cents = extra.gt(0) ? base.plus(1) : base;
    if (extra.gt(0)) extra = extra.minus(1);
    shares.push(cents.dividedBy(100));
  }

  return shares;
}
