import { describe, expect, it } from "@jest/globals";
import { orderTenantsForAdmin } from "@/modules/platform/domain/tenant-order";

/** Written, not run. Suspended first, then overdue, then the rest, each group by name. */
const row = (slug: string, name: string, status: "ACTIVE" | "SUSPENDED" = "ACTIVE", overdue = false) => ({ slug, name, status, overdue });

describe("orderTenantsForAdmin", () => {
  it("orders suspended, then overdue, then the rest by name (case ignored)", () => {
    const ordered = orderTenantsForAdmin([
      row("z", "Zeta"),
      row("a", "alpha", "ACTIVE", true),
      row("m", "Mid", "SUSPENDED"),
      row("b", "Beta"),
      row("s", "Aardvark", "SUSPENDED", true),
    ]);
    expect(ordered.map((item) => item.slug)).toEqual(["s", "m", "a", "b", "z"]);
  });

  it("does not change the input, and ties on name fall back to the slug", () => {
    const input = [row("two", "Same"), row("one", "Same")];
    expect(orderTenantsForAdmin(input).map((item) => item.slug)).toEqual(["one", "two"]);
    expect(input.map((item) => item.slug)).toEqual(["two", "one"]);
  });

  it("handles an empty list", () => {
    expect(orderTenantsForAdmin([])).toEqual([]);
  });
});
