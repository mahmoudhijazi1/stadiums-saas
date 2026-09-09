import { describe, expect, it } from "@jest/globals";
import { normalizePhone } from "@/modules/people/domain/phone";

describe("normalizePhone", () => {
  it("strips spaces, dashes, and + so the same number is one person", () => {
    expect(normalizePhone("03 123 456")).toBe("03123456");
    expect(normalizePhone("03-123-456")).toBe("03123456");
    expect(normalizePhone("+961 3 123456")).toBe("9613123456");
  });

  it("is a no-op when the value is already digits", () => {
    expect(normalizePhone("03123456")).toBe("03123456");
  });
});
