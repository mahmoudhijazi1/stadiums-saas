import { describe, expect, it } from "@jest/globals";
import { parseLogin } from "@/modules/access/schemas/login";

const valid = {
  identifier: "owner@ahmad",
  password: "secret",
};

describe("parseLogin", () => {
  it("accepts owner@ahmad and lower-cases the identifier", () => {
    expect(parseLogin(valid)).toEqual(valid);
    expect(parseLogin({ identifier: "Owner@Ahmad", password: "secret" })).toEqual(
      valid,
    );
  });

  it("rejects a missing password", () => {
    const { password: _ignored, ...withoutPassword } = valid;
    expect(() => parseLogin(withoutPassword)).toThrow();
  });

  it("rejects an extra field", () => {
    expect(() => parseLogin({ ...valid, tenantId: "nope" })).toThrow();
  });
});
