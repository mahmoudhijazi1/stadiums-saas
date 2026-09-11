import { describe, expect, it } from "@jest/globals";
import { parseLedgerPeriodQuery } from "@/modules/ledger/schemas/period-query";

describe("parseLedgerPeriodQuery", () => {
  it("accepts a calendar month", () => {
    expect(
      parseLedgerPeriodQuery({ from: "2026-07-01", to: "2026-07-31" }),
    ).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
      view: "usd",
      displayRate: undefined,
    });
  });

  it("defaults omitted fields to the current-month path (usd, no typed rate)", () => {
    expect(parseLedgerPeriodQuery({})).toEqual({
      from: undefined,
      to: undefined,
      view: "usd",
      displayRate: undefined,
    });
  });

  it("accepts LBP view with a typed display rate", () => {
    expect(
      parseLedgerPeriodQuery({
        from: "2026-07-01",
        to: "2026-07-31",
        view: "lbp",
        displayRate: "90000",
      }),
    ).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
      view: "lbp",
      displayRate: "90000",
    });
  });

  it("treats an empty display rate as omitted", () => {
    expect(
      parseLedgerPeriodQuery({
        from: "2026-07-01",
        to: "2026-07-31",
        displayRate: "",
      }),
    ).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
      view: "usd",
      displayRate: undefined,
    });
  });

  it("rejects from after to", () => {
    expect(() =>
      parseLedgerPeriodQuery({ from: "2026-07-31", to: "2026-07-01" }),
    ).toThrow();
  });

  it("rejects a bad date", () => {
    expect(() =>
      parseLedgerPeriodQuery({ from: "30", to: "2026-07-01" }),
    ).toThrow();
    expect(() =>
      parseLedgerPeriodQuery({ from: "2026-02-31", to: "2026-03-01" }),
    ).toThrow();
  });

  it("rejects an extra field", () => {
    expect(() =>
      parseLedgerPeriodQuery({
        from: "2026-07-01",
        to: "2026-07-31",
        tenant: "ahmad",
      }),
    ).toThrow();
  });
});
