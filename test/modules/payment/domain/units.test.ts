import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  friendlyLbp,
  isForgivable,
  moneyUnit,
  roundToUnit,
  splitInUnits,
} from "@/modules/payment/domain/units";

const dec = (value: string | number) => new Decimal(value);
const texts = (values: Decimal[]) => values.map((value) => value.toFixed(2));

function thrownKey(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as { key?: string }).key;
  }
  return undefined;
}

describe("moneyUnit", () => {
  it("is $1 and 5,000 LBP", () => {
    expect(moneyUnit("USD").toFixed(2)).toBe("1.00");
    expect(moneyUnit("LBP").toFixed(0)).toBe("5000");
  });
});

describe("roundToUnit", () => {
  it("LBP: rounds to the nearest 5,000, half up", () => {
    expect(roundToUnit(dec(2499), "LBP").toFixed(0)).toBe("0");
    expect(roundToUnit(dec(2500), "LBP").toFixed(0)).toBe("5000");
    expect(roundToUnit(dec(7499), "LBP").toFixed(0)).toBe("5000");
    expect(roundToUnit(dec(7500), "LBP").toFixed(0)).toBe("10000");
    expect(roundToUnit(dec(285714), "LBP").toFixed(0)).toBe("285000");
    expect(roundToUnit(dec(290000), "LBP").toFixed(0)).toBe("290000");
  });

  it("USD: rounds to the nearest dollar, half up", () => {
    expect(roundToUnit(dec("0.49"), "USD").toFixed(2)).toBe("0.00");
    expect(roundToUnit(dec("0.50"), "USD").toFixed(2)).toBe("1.00");
    expect(roundToUnit(dec("22.49"), "USD").toFixed(2)).toBe("22.00");
    expect(roundToUnit(dec("22.50"), "USD").toFixed(2)).toBe("23.00");
  });
});

describe("splitInUnits", () => {
  it("2,000,000 LBP over 7: one of 290,000 first, then six of 285,000", () => {
    const shares = splitInUnits(dec(2000000), 7, "LBP");
    expect(shares.map((share) => share.toFixed(0))).toEqual([
      "290000", "285000", "285000", "285000", "285000", "285000", "285000",
    ]);
  });

  it("$40 over 7: five of $6 first, then two of $5", () => {
    expect(texts(splitInUnits(dec(40), 7, "USD"))).toEqual([
      "6.00", "6.00", "6.00", "6.00", "6.00", "5.00", "5.00",
    ]);
  });

  it("a total that is not a multiple of the unit: the part below one unit goes to the first share", () => {
    // 1,002,500 = 200 units of 5,000 + 2,500 over 3 players: 67, 67, 66 units, +2,500 on the first.
    expect(splitInUnits(dec(1002500), 3, "LBP").map((share) => share.toFixed(0))).toEqual(["337500", "335000", "330000"]);
    // $40.50 over 3: 14, 13, 13 dollars, +$0.50 on the first.
    expect(texts(splitInUnits(dec("40.50"), 3, "USD"))).toEqual(["14.50", "13.00", "13.00"]);
  });

  it("fewer units than players: some shares are 0 ($3 over 7 is three of $1 and four of $0)", () => {
    expect(texts(splitInUnits(dec(3), 7, "USD"))).toEqual(["1.00", "1.00", "1.00", "0.00", "0.00", "0.00", "0.00"]);
    expect(splitInUnits(dec(0), 4, "LBP").every((share) => share.isZero())).toBe(true);
  });

  it("one player gets everything", () => {
    expect(splitInUnits(dec(2000000), 1, "LBP").map((share) => share.toFixed(0))).toEqual(["2000000"]);
  });

  it("refuses a count below 1, a count that is not whole, and a negative total", () => {
    expect(thrownKey(() => splitInUnits(dec(40), 0, "USD"))).toBe("booking.split_count");
    expect(thrownKey(() => splitInUnits(dec(40), -2, "USD"))).toBe("booking.split_count");
    expect(thrownKey(() => splitInUnits(dec(40), 2.5, "USD"))).toBe("booking.split_count");
    expect(thrownKey(() => splitInUnits(dec(-1), 2, "USD"))).toBe("payment.amount_positive");
  });

  it("always adds up exactly and never differs by more than one unit (counts 1..30, both currencies)", () => {
    const totals = {
      USD: [dec(0), dec(1), dec(3), dec(7), dec(29), dec(40), dec(100), dec("40.50"), dec("99.99"), dec(1234)],
      LBP: [dec(0), dec(5000), dec(15000), dec(35000), dec(145000), dec(1002500), dec(2000000), dec(2000001), dec(3333335)],
    } as const;
    for (const currency of ["USD", "LBP"] as const) {
      const unit = moneyUnit(currency);
      for (const total of totals[currency]) {
        for (let count = 1; count <= 30; count += 1) {
          const shares = splitInUnits(total, count, currency);
          expect(shares).toHaveLength(count);

          const sum = shares.reduce((acc, share) => acc.plus(share), new Decimal(0));
          expect(sum.equals(total)).toBe(true);

          // Without the part below one unit (on the first share) every share is whole units.
          const belowUnit = total.minus(total.div(unit).floor().times(unit));
          const whole = shares.map((share, index) => (index === 0 ? share.minus(belowUnit) : share));
          for (const share of whole) {
            expect(share.mod(unit).isZero()).toBe(true);
            expect(share.gte(0)).toBe(true);
          }
          const biggest = Decimal.max(...whole);
          const smallest = Decimal.min(...whole);
          expect(biggest.minus(smallest).lte(unit)).toBe(true);
          // The leftover units go to the first shares: the shares never increase along the list.
          for (let i = 1; i < count; i += 1) {
            expect(whole[i]!.lte(whole[i - 1]!)).toBe(true);
          }
        }
      }
    }
  });
});

describe("friendlyLbp", () => {
  it("rounds up to the next multiple of 5,000 and never down", () => {
    expect(friendlyLbp(dec(535000)).toFixed(0)).toBe("535000");
    expect(friendlyLbp(dec(537000)).toFixed(0)).toBe("540000");
    expect(friendlyLbp(dec(540000)).toFixed(0)).toBe("540000");
    expect(friendlyLbp(dec(1)).toFixed(0)).toBe("5000");
    expect(friendlyLbp(dec(0)).toFixed(0)).toBe("0");
  });
});

describe("isForgivable", () => {
  const rate = dec(90000);

  it("LBP: only more than 0 and under 5,000", () => {
    expect(isForgivable(dec(0), "LBP", null)).toBe(false);
    expect(isForgivable(dec(1), "LBP", null)).toBe(true);
    expect(isForgivable(dec(4999), "LBP", null)).toBe(true);
    expect(isForgivable(dec(5000), "LBP", null)).toBe(false);
    expect(isForgivable(dec(285000), "LBP", rate)).toBe(false);
  });

  it("USD with a rate: only what is worth under 5,000 LBP", () => {
    expect(isForgivable(dec(0), "USD", rate)).toBe(false);
    expect(isForgivable(dec("0.05"), "USD", rate)).toBe(true); // 4,500 LBP
    expect(isForgivable(dec("0.06"), "USD", rate)).toBe(false); // 5,400 LBP
    expect(isForgivable(dec("0.05"), "USD", dec(100000))).toBe(false); // 5,000 LBP exactly
    expect(isForgivable(dec(1), "USD", rate)).toBe(false);
  });

  it("USD without a usable rate: never", () => {
    expect(isForgivable(dec("0.01"), "USD", null)).toBe(false);
    expect(isForgivable(dec("0.01"), "USD", dec(0))).toBe(false);
  });
});
