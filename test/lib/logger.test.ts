import { describe, expect, it } from "@jest/globals";
import { formatLogContext } from "@/lib/logger";

describe("formatLogContext", () => {
  it("appends useCase and tenantId", () => {
    expect(
      formatLogContext({ useCase: "approveBooking", tenantId: "ten_1" }),
    ).toBe(" useCase=approveBooking tenantId=ten_1");
  });

  it("is empty when context is missing or blank", () => {
    expect(formatLogContext()).toBe("");
    expect(formatLogContext({})).toBe("");
  });
});
