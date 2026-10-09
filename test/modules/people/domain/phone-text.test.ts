import { describe, expect, it } from "@jest/globals";
import { publicRequestFieldErrors } from "@/lib/request-fields";
import { parsePublicSlotRequest } from "@/modules/booking/schemas/public-slot-request";
import { isPhoneText, normalizePhone, sanitizePhoneInput } from "@/modules/people/domain/phone";

describe("phone text", () => {
  it("accepts digits and + - ( ) . and spaces only", () => {
    for (const ok of ["03123456", "+961 3 123 456", "(03) 123-456", "03.123.456", "٠٣١٢٣٤٥٦", ""]) {
      expect(isPhoneText(ok)).toBe(true);
    }
    for (const bad of ["03abc456", "call me", "0312345x", "03123456;", "03/123456", "٠٣١٢٣٤٥٦a"]) {
      expect(isPhoneText(bad)).toBe(false);
    }
  });

  it("sanitizes what is typed or pasted and converts Arabic digits", () => {
    expect(sanitizePhoneInput("03abc 123-456")).toBe("03 123-456");
    expect(sanitizePhoneInput("٠٣ ١٢٣٤٥٦")).toBe("03 123456");
    expect(sanitizePhoneInput("+961 (3) 123.456")).toBe("+961 (3) 123.456");
  });

  it("normalizes Arabic digits to the same number as Latin ones", () => {
    expect(normalizePhone("٠٣١٢٣٤٥٦")).toBe("03123456");
  });

  it("the form check and the server schema both refuse letters", () => {
    expect(publicRequestFieldErrors("Ali", "03abc123456").phone).toBe("public.errPhone");
    expect(publicRequestFieldErrors("Ali", "03 123 456").phone).toBeUndefined();
    const base = { name: "Ali", pitchId: "p", start: "2030-01-01T10:00:00Z", end: "2030-01-01T11:00:00Z" };
    expect(() => parsePublicSlotRequest({ ...base, phone: "03abc123456" })).toThrow();
    expect(parsePublicSlotRequest({ ...base, phone: "03 123-456" }).phone).toBe("03123456");
  });
});
