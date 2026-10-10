import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import { buildCashDay, cashLineCurrencies } from "@/modules/payment/domain/cash-day";

/** Written, not run when authored. "Cash today": net per currency, never converted or combined. */
const d = (value: string) => new Decimal(value);

describe("buildCashDay", () => {
  it("is the net per currency: IN tenders minus OUT tenders, USD and LBP kept apart", () => {
    const day = buildCashDay([
      { direction: "IN", currency: "USD", amount: d("175.00") },
      { direction: "IN", currency: "LBP", amount: d("3000000") },
      { direction: "OUT", currency: "USD", amount: d("35.00") },
      { direction: "OUT", currency: "LBP", amount: d("300000") },
    ]);
    expect(day.net.USD.toFixed(2)).toBe("140.00");
    expect(day.net.LBP.toFixed(0)).toBe("2700000");
    expect(day.in.USD.toFixed(2)).toBe("175.00");
    expect(day.out.LBP.toFixed(0)).toBe("300000");
    expect(day.any).toBe(true);
  });

  it("an expense paid in pounds only lowers the pound net, never the dollar one", () => {
    const day = buildCashDay([
      { direction: "IN", currency: "USD", amount: d("50.00") },
      { direction: "OUT", currency: "LBP", amount: d("900000") },
    ]);
    expect(day.net.USD.toFixed(2)).toBe("50.00");
    expect(day.net.LBP.toFixed(0)).toBe("-900000");
  });

  it("sums several tenders of the same direction and currency", () => {
    const day = buildCashDay([
      { direction: "IN", currency: "USD", amount: d("10.00") },
      { direction: "IN", currency: "USD", amount: d("2.50") },
    ]);
    expect(day.net.USD.toFixed(2)).toBe("12.50");
  });

  it("an empty day is zero in both and says there was nothing", () => {
    const day = buildCashDay([]);
    expect(day.net.USD.isZero()).toBe(true);
    expect(day.net.LBP.isZero()).toBe(true);
    expect(day.any).toBe(false);
  });
});

describe("cashLineCurrencies", () => {
  it("shows each currency that has a net, dollars first", () => {
    const both = buildCashDay([
      { direction: "IN", currency: "LBP", amount: d("100000") },
      { direction: "IN", currency: "USD", amount: d("5.00") },
    ]);
    expect(cashLineCurrencies(both)).toEqual(["USD", "LBP"]);
  });

  it("leaves out a currency that nets to zero", () => {
    const day = buildCashDay([
      { direction: "IN", currency: "LBP", amount: d("100000") },
      { direction: "OUT", currency: "USD", amount: d("5.00") },
      { direction: "IN", currency: "USD", amount: d("5.00") },
    ]);
    expect(cashLineCurrencies(day)).toEqual(["LBP"]);
  });

  it("an empty day shows just dollars, as $0", () => {
    expect(cashLineCurrencies(buildCashDay([]))).toEqual(["USD"]);
  });
});
