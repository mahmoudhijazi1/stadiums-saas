import { describe, expect, it } from "@jest/globals";
import { publicRequestFieldErrors } from "@/app/(public)/request-fields";

describe("publicRequestFieldErrors", () => {
  it("requires a name and 8–15 digit phone", () => {
    expect(publicRequestFieldErrors("  ", "12")).toEqual({
      name: "public.errName",
      phone: "public.errPhone",
    });
    expect(publicRequestFieldErrors("Ahmad", "03 123 456")).toEqual({});
  });
});
