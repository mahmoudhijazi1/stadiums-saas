import { describe, expect, it } from "@jest/globals";
import { successMessage } from "@/lib/success-messages";

describe("successMessage", () => {
  it("returns catalog Arabic for a known key", () => {
    expect(successMessage("requested")).toBe("وصل الطلب.");
    expect(successMessage("approved")).toBe("تمت الموافقة.");
  });

  it("returns catalog English when locale is en", () => {
    expect(successMessage("requested", "en")).toBe("Request received.");
    expect(successMessage("approved", "en")).toBe("Approved.");
  });

  it("returns generic Arabic for an unknown key", () => {
    expect(successMessage("not.a.real.key")).toBe("تم.");
  });

  it("returns generic English for an unknown key", () => {
    expect(successMessage("not.a.real.key", "en")).toBe("Done.");
  });
});
