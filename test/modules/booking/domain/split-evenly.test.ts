import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import { splitEvenly } from "@/modules/booking/domain/split-evenly";

function sum(shares: Decimal[]): Decimal {
  return shares.reduce((total, share) => total.plus(share), new Decimal(0));
}

describe("splitEvenly", () => {
  it("splits 30 across 7 as four 4.29 and three 4.28", () => {
    const shares = splitEvenly(new Decimal("30.00"), 7);
    expect(shares.filter((share) => share.equals("4.29"))).toHaveLength(4);
    expect(shares.filter((share) => share.equals("4.28"))).toHaveLength(3);
    expect(shares.slice(0, 4).every((share) => share.equals("4.29"))).toBe(true);
    expect(sum(shares).equals("30.00")).toBe(true);
  });

  it("splits 30 across 10 into equal 3.00 shares", () => {
    const shares = splitEvenly(new Decimal("30.00"), 10);
    expect(shares).toHaveLength(10);
    expect(shares.every((share) => share.equals("3.00"))).toBe(true);
    expect(sum(shares).equals("30.00")).toBe(true);
  });

  it("returns the whole amount when n is 1", () => {
    const shares = splitEvenly(new Decimal("30.00"), 1);
    expect(shares).toHaveLength(1);
    expect(shares[0]?.equals("30.00")).toBe(true);
  });

  it("rejects a count of 0", () => {
    expect(() => splitEvenly(new Decimal("30.00"), 0)).toThrow("booking.split_count");
  });
});

describe("splitEvenly properties (n = 1…30, wide range of amounts)", () => {
  /** Deterministic amounts: every cent up to $30, a seeded spread up to $1,000,000, edges. */
  function amounts(): Decimal[] {
    const list: Decimal[] = [];
    for (let cents = 0; cents <= 3_000; cents += 1) list.push(new Decimal(cents).div(100));
    let seed = 20260930;
    for (let i = 0; i < 1_000; i += 1) {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      list.push(new Decimal(seed % 100_000_000).div(100));
    }
    for (const edge of ["29.99", "30.01", "1234.57", "9999999999.99"]) {
      list.push(new Decimal(edge));
    }
    return list;
  }

  it("never loses or gains a cent; shares differ by at most one cent, first slots first", () => {
    const failures: string[] = [];
    let checked = 0;
    for (const amount of amounts()) {
      for (let n = 1; n <= 30; n += 1) {
        const shares = splitEvenly(amount, n);
        const exact = shares.length === n && sum(shares).equals(amount);
        const spread = Decimal.max(...shares).minus(Decimal.min(...shares)).lte("0.01");
        const cents = shares.every((share) => share.gte(0) && share.times(100).isInteger());
        // Non-increasing: the extra cents go to the first slots.
        const ordered = shares.every((share, i) => i === 0 || share.lte(shares[i - 1]!));
        if (!(exact && spread && cents && ordered)) failures.push(`${amount.toFixed(2)} / ${n}`);
        checked += 1;
      }
    }
    expect(failures).toEqual([]);
    expect(checked).toBe(4_005 * 30);
  });
});
