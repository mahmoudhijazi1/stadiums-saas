import Decimal from "decimal.js";
import { describe, expect, it } from "@jest/globals";
import { can } from "@/modules/access/domain/can";
import {
  assertFullyPaid,
  assertQty,
  isValidQty,
  lineTotal,
  mergeLines,
  orderByPopularity,
  QTY_MAX,
  saleTotal,
} from "@/modules/shop/domain/sale";
import { parseProductInput } from "@/modules/shop/schemas/product";

const d = (value: string) => new Decimal(value);

describe("line and sale totals (exact, Decimal)", () => {
  it("multiplies unit price by quantity to the cent", () => {
    expect(lineTotal(d("1.50"), 3).toFixed(2)).toBe("4.50");
    expect(lineTotal(d("0.10"), 3).toFixed(2)).toBe("0.30"); // not 0.30000000000000004
    expect(lineTotal(d("9999.99"), 99).toFixed(2)).toBe("989999.01");
  });

  it("a sale total is the sum of its lines", () => {
    expect(saleTotal([{ lineTotalUsd: d("4.50") }, { lineTotalUsd: d("2.25") }, { lineTotalUsd: d("0.30") }]).toFixed(2)).toBe("7.05");
    expect(saleTotal([]).toFixed(2)).toBe("0.00");
  });
});

describe("quantity bounds", () => {
  it.each([
    [1, true],
    [99, true],
    [0, false],
    [100, false],
    [-1, false],
    [1.5, false],
    [Number.NaN, false],
  ])("%s -> %s", (qty, valid) => {
    expect(isValidQty(qty)).toBe(valid);
    if (valid) expect(() => assertQty(qty)).not.toThrow();
    else expect(() => assertQty(qty)).toThrow(expect.objectContaining({ key: "shop.qty_invalid" }));
  });

  it("merges the same item twice and keeps the result within 1 to 99", () => {
    expect(mergeLines([{ productId: "a", qty: 2 }, { productId: "b", qty: 1 }, { productId: "a", qty: 3 }])).toEqual([
      { productId: "a", qty: 5 },
      { productId: "b", qty: 1 },
    ]);
    expect(() => mergeLines([{ productId: "a", qty: 60 }, { productId: "a", qty: 60 }])).toThrow(
      expect.objectContaining({ key: "shop.qty_invalid" }),
    );
    expect(QTY_MAX).toBe(99);
  });
});

describe("orderByPopularity", () => {
  it("most sold in the last 30 days first, then by name", () => {
    const items = [
      { id: "1", name: "Water", sold30d: 0 },
      { id: "2", name: "Cola", sold30d: 5 },
      { id: "3", name: "Chips", sold30d: 5 },
      { id: "4", name: "Gum", sold30d: 12 },
      { id: "5", name: "Apple", sold30d: 0 },
    ];
    expect(orderByPopularity(items).map((item) => item.name)).toEqual(["Gum", "Chips", "Cola", "Apple", "Water"]);
  });

  it("is stable for the same name and does not change its input", () => {
    const items = [
      { id: "b", name: "Same", sold30d: 1 },
      { id: "a", name: "Same", sold30d: 1 },
    ];
    expect(orderByPopularity(items).map((item) => item.id)).toEqual(["a", "b"]);
    expect(items.map((item) => item.id)).toEqual(["b", "a"]);
  });
});

describe("a walk-in sale must be paid in full", () => {
  it("refuses less than the total, accepts the total and more", () => {
    expect(() => assertFullyPaid(d("4.99"), d("5.00"))).toThrow(expect.objectContaining({ key: "shop.sale_not_fully_paid" }));
    expect(() => assertFullyPaid(d("5.00"), d("5.00"))).not.toThrow();
    expect(() => assertFullyPaid(d("10.00"), d("5.00"))).not.toThrow();
  });
});

describe("product input", () => {
  it("keeps the name as written, cleaned, and the price to the cent", () => {
    expect(parseProductInput({ name: "  Pepsi   Max  ", priceUsd: "1.50" })).toEqual({ name: "Pepsi Max", priceUsd: "1.50" });
    expect(parseProductInput({ name: "ماء", priceUsd: "1" })).toEqual({ name: "ماء", priceUsd: "1.00" });
    expect(parseProductInput({ name: "Cola", priceUsd: "10000" }).priceUsd).toBe("10000.00");
  });

  it.each([
    [{ name: "", priceUsd: "1.00" }],
    [{ name: "   ", priceUsd: "1.00" }],
    [{ name: "x".repeat(61), priceUsd: "1.00" }],
    [{ name: "Cola", priceUsd: "0" }],
    [{ name: "Cola", priceUsd: "0.00" }],
    [{ name: "Cola", priceUsd: "-1.00" }],
    [{ name: "Cola", priceUsd: "10000.01" }],
    [{ name: "Cola", priceUsd: "1.234" }],
    [{ name: "Cola", priceUsd: "1.5" }], // cents are exact: 1.50
    [{ name: "Cola", priceUsd: "abc" }],
    [{ name: "Cola", priceUsd: "1.00", extra: 1 }],
  ])("refuses %j", (input) => {
    expect(() => parseProductInput(input)).toThrow();
  });

  it("allows exactly 60 characters", () => {
    expect(parseProductInput({ name: "x".repeat(60), priceUsd: "1.00" }).name).toHaveLength(60);
  });
});

describe("shop permissions", () => {
  it("owner can sell and manage; staff sell only with the flag and never manage", () => {
    const owner = { role: "OWNER" as const, permissions: {} };
    const staffDefault = { role: "STAFF" as const, permissions: { "shop.sell": true } };
    const staffNone = { role: "STAFF" as const, permissions: {} };
    const staffTriedManage = { role: "STAFF" as const, permissions: { "shop.sell": true, "shop.manage": true } };
    expect(can(owner, "shop.sell")).toBe(true);
    expect(can(owner, "shop.manage")).toBe(true);
    expect(can(staffDefault, "shop.sell")).toBe(true);
    expect(can(staffNone, "shop.sell")).toBe(false);
    expect(can(staffDefault, "shop.manage")).toBe(false);
    expect(can(staffTriedManage, "shop.manage")).toBe(false);
  });
});
