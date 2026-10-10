import { describe, expect, it } from "@jest/globals";
import { orderCategories, rememberCategory } from "@/modules/expense/domain/category-order";

/** Written, not run when authored. The expense sheet's category chips, most recently used first. */
const ALL = ["ELECTRICITY", "WATER", "MAINTENANCE", "SALARY", "EQUIPMENT", "OTHER", "SHOP_SUPPLIES"] as const;

describe("orderCategories", () => {
  it("keeps the usual order when nothing was used yet", () => {
    expect(orderCategories(ALL, [])).toEqual([...ALL]);
  });

  it("puts the most recently used first, then the rest in their usual order", () => {
    expect(orderCategories(ALL, ["SALARY", "WATER"])).toEqual([
      "SALARY",
      "WATER",
      "ELECTRICITY",
      "MAINTENANCE",
      "EQUIPMENT",
      "OTHER",
      "SHOP_SUPPLIES",
    ]);
  });

  it("ignores junk from browser storage: unknown names, non-strings and repeats", () => {
    expect(orderCategories(ALL, ["NOPE", 7, null, "WATER", "WATER", { a: 1 }])).toEqual([
      "WATER",
      "ELECTRICITY",
      "MAINTENANCE",
      "SALARY",
      "EQUIPMENT",
      "OTHER",
      "SHOP_SUPPLIES",
    ]);
  });

  it("never drops or duplicates a category", () => {
    const ordered = orderCategories(ALL, ["OTHER", "SHOP_SUPPLIES", "ELECTRICITY"]);
    expect([...ordered].sort()).toEqual([...ALL].sort());
  });
});

describe("rememberCategory", () => {
  it("puts the picked category first and moves it up if it was already there", () => {
    expect(rememberCategory(["WATER", "SALARY"], "SALARY")).toEqual(["SALARY", "WATER"]);
  });

  it("keeps the list short and drops junk", () => {
    const many = Array.from({ length: 12 }, (_, i) => `C${i}`);
    expect(rememberCategory(many, "NEW", 8)).toHaveLength(8);
    expect(rememberCategory(["A", 3, null], "B")).toEqual(["B", "A"]);
  });
});
