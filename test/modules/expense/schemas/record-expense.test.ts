import { describe, expect, it } from "@jest/globals";
import { parseRecordExpense } from "@/modules/expense/schemas/record-expense";

const valid = {
  category: "ELECTRICITY" as const,
  description: "EDL July",
  occurredOn: "2026-07-15",
};

describe("parseRecordExpense", () => {
  it("accepts an LBP-only expense", () => {
    expect(
      parseRecordExpense({ ...valid, lbpAmount: "1800000" }),
    ).toEqual({
      ...valid,
      usdAmount: undefined,
      lbpAmount: "1800000",
    });
  });

  it("accepts a whole-dollar USD amount as cents", () => {
    expect(parseRecordExpense({ ...valid, usdAmount: "30" })).toEqual({
      ...valid,
      usdAmount: "30.00",
      lbpAmount: undefined,
    });
  });

  it("rejects a missing category", () => {
    expect(() =>
      parseRecordExpense({
        description: "EDL July",
        occurredOn: "2026-07-15",
        lbpAmount: "1800000",
      }),
    ).toThrow();
  });

  it("rejects an empty description", () => {
    expect(() =>
      parseRecordExpense({ ...valid, description: "   ", lbpAmount: "1800000" }),
    ).toThrow();
  });

  it("rejects both amounts empty", () => {
    expect(() => parseRecordExpense(valid)).toThrow();
    expect(() =>
      parseRecordExpense({ ...valid, usdAmount: "", lbpAmount: "" }),
    ).toThrow();
  });

  it("rejects an extra field", () => {
    expect(() =>
      parseRecordExpense({
        ...valid,
        lbpAmount: "1800000",
        tenant: "ahmad",
      }),
    ).toThrow();
  });
});
