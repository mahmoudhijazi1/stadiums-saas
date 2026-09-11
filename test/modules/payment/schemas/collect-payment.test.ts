import { describe, expect, it } from "@jest/globals";
import { parseCollectPayment } from "@/modules/payment/schemas/collect-payment";
import { parseExchangeRate } from "@/modules/payment/schemas/exchange-rate";

describe("parseCollectPayment", () => {
  it("accepts a USD-only collect", () => {
    expect(
      parseCollectPayment({ bookingId: "bk_1", usdAmount: "30.00" }),
    ).toEqual({
      bookingId: "bk_1",
      usdAmount: "30.00",
      lbpAmount: undefined,
    });
  });

  it("accepts mixed USD and LBP", () => {
    expect(
      parseCollectPayment({
        bookingId: "bk_1",
        usdAmount: "20.00",
        lbpAmount: "900000",
      }),
    ).toEqual({
      bookingId: "bk_1",
      usdAmount: "20.00",
      lbpAmount: "900000",
    });
  });

  it("treats blank amounts as omitted", () => {
    expect(
      parseCollectPayment({
        bookingId: "bk_1",
        usdAmount: "10.00",
        lbpAmount: "",
      }),
    ).toEqual({
      bookingId: "bk_1",
      usdAmount: "10.00",
      lbpAmount: undefined,
    });
  });

  it("rejects a missing bookingId", () => {
    expect(() => parseCollectPayment({ usdAmount: "30.00" })).toThrow();
  });

  it("rejects both amounts empty", () => {
    expect(() => parseCollectPayment({ bookingId: "bk_1" })).toThrow();
    expect(() =>
      parseCollectPayment({ bookingId: "bk_1", usdAmount: "", lbpAmount: "" }),
    ).toThrow();
  });

  it("accepts a whole-dollar USD amount as cents", () => {
    expect(
      parseCollectPayment({ bookingId: "bk_1", usdAmount: "30" }),
    ).toEqual({
      bookingId: "bk_1",
      usdAmount: "30.00",
      lbpAmount: undefined,
    });
  });

  it("rejects USD that is not exact cents", () => {
    expect(() =>
      parseCollectPayment({ bookingId: "bk_1", usdAmount: "30.0" }),
    ).toThrow();
  });

  it("rejects an extra field", () => {
    expect(() =>
      parseCollectPayment({
        bookingId: "bk_1",
        usdAmount: "30.00",
        tenant: "ahmad",
      }),
    ).toThrow();
  });
});

describe("parseExchangeRate", () => {
  it("accepts a positive integer rate", () => {
    expect(parseExchangeRate({ lbpPerUsd: "90000" })).toEqual({
      lbpPerUsd: "90000",
    });
  });

  it("rejects zero and extra keys", () => {
    expect(() => parseExchangeRate({ lbpPerUsd: "0" })).toThrow();
    expect(() =>
      parseExchangeRate({ lbpPerUsd: "90000", tenant: "ahmad" }),
    ).toThrow();
  });
});
