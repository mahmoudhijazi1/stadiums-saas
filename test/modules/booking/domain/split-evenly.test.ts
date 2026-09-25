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
