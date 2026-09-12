import { describe, expect, it } from "@jest/globals";
import { successMessage } from "@/lib/success-messages";

describe("successMessage", () => {
  it("returns catalog English for a known key", () => {
    expect(successMessage("requested")).toBe("Request received.");
    expect(successMessage("approved")).toBe("Approved.");
  });

  it("returns generic English for an unknown key", () => {
    expect(successMessage("not.a.real.key")).toBe("Done.");
  });
});
