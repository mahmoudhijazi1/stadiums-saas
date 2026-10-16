import { describe, expect, it } from "@jest/globals";
import Decimal from "decimal.js";
import {
  dueChangeAmounts,
  gameDue,
  gamePrice,
  requireUsd,
  shareDue,
} from "@/modules/booking/domain/game-money";

function thrownKey(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return (error as { key?: string }).key;
  }
  return undefined;
}

const usdBooking = { priceCurrency: "USD" as const, priceUsd: "30.00", amountDueUsd: "20.00", priceLbp: null, amountDueLbp: null };
const lbpBooking = { priceCurrency: "LBP" as const, priceUsd: null, amountDueUsd: null, priceLbp: "2000000", amountDueLbp: "1500000" };

describe("game money accessors (DR-007)", () => {
  it("read the columns of the game's currency", () => {
    expect(gamePrice(usdBooking)).toEqual({ currency: "USD", amount: new Decimal("30.00") });
    expect(gameDue(usdBooking)).toEqual({ currency: "USD", amount: new Decimal("20.00") });
    expect(gamePrice(lbpBooking)).toEqual({ currency: "LBP", amount: new Decimal("2000000") });
    expect(gameDue(lbpBooking)).toEqual({ currency: "LBP", amount: new Decimal("1500000") });
  });

  it("a share takes the currency of the column that is set", () => {
    expect(shareDue({ amountDueUsd: new Decimal("10.00"), amountDueLbp: null })).toEqual({ currency: "USD", amount: new Decimal("10.00") });
    expect(shareDue({ amountDueUsd: null, amountDueLbp: "285000" })).toEqual({ currency: "LBP", amount: new Decimal("285000") });
  });

  it("a due change reads its own pair", () => {
    expect(dueChangeAmounts({ currency: "USD", fromUsd: "30.00", toUsd: "20.00", fromLbp: null, toLbp: null })).toEqual({
      currency: "USD", from: new Decimal("30.00"), to: new Decimal("20.00"),
    });
    expect(dueChangeAmounts({ currency: "LBP", fromUsd: null, toUsd: null, fromLbp: "2000000", toLbp: "1500000" })).toEqual({
      currency: "LBP", from: new Decimal("2000000"), to: new Decimal("1500000"),
    });
  });

  it("a missing column for its currency is an error, never zero", () => {
    expect(() => gameDue({ ...usdBooking, amountDueUsd: null })).toThrow(/amountDueUsd/);
    expect(() => gamePrice({ ...lbpBooking, priceLbp: null })).toThrow(/priceLbp/);
  });
});

describe("requireUsd", () => {
  it("returns the USD amount of a USD game", () => {
    expect(requireUsd(gameDue(usdBooking), "test").toFixed(2)).toBe("20.00");
  });

  it("refuses an LBP game with booking.lbp_not_supported", () => {
    expect(thrownKey(() => requireUsd(gameDue(lbpBooking), "test"))).toBe("booking.lbp_not_supported");
  });
});
