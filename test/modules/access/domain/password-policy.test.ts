import { describe, expect, it } from "@jest/globals";
import {
  checkPassword,
  describePasswordRefusal,
  MIN_PASSWORD_LENGTH,
  PASSWORD_DENYLIST,
} from "@/modules/access/domain/password-policy";

const context = { identifier: "owner@al-nour" };

describe("checkPassword", () => {
  it.each([
    ["a long owner password", null],
    ["correct horse battery staple", null],
    ["            ", null], // 12 spaces: no composition rules
    ["كلمة سر طويلة جداً", null],
    ["abcdefghijkl", null], // exactly 12
    ["abcdefghijk", "too_short"], // 11
    ["", "too_short"],
    ["owner@al-nour", "same_as_identifier"],
    ["OWNER@AL-NOUR", "same_as_identifier"],
    ["  owner@al-nour  ", "same_as_identifier"],
    ["password1234", "denylisted"],
    ["PassWord1234", "denylisted"],
    ["  Password1234 ", "denylisted"],
    ["test-owner-password", "denylisted"],
    ["dev-owner-password", "denylisted"],
  ] as const)("%j -> %s", (password, expected) => {
    expect(checkPassword(password, context)).toBe(expected);
  });

  it("refuses the local part and the slug when they are long enough to pass the length rule", () => {
    expect(checkPassword("administrators", { identifier: "administrators@x" })).toBe("same_as_identifier");
    expect(checkPassword("the-long-stadium-slug", { identifier: "owner@the-long-stadium-slug" })).toBe(
      "same_as_identifier",
    );
    expect(checkPassword("the-long-stadium-slug", { identifier: "owner@x", slug: "the-long-stadium-slug" })).toBe(
      "same_as_identifier",
    );
  });

  it("counts characters, not bytes", () => {
    expect(checkPassword("😀".repeat(11), context)).toBe("too_short");
    expect(checkPassword("😀".repeat(12), context)).toBeNull();
  });

  it("keeps the denylist entries lowercase and describes every refusal", () => {
    for (const entry of PASSWORD_DENYLIST) expect(entry).toBe(entry.toLowerCase());
    expect(MIN_PASSWORD_LENGTH).toBe(12);
    for (const refusal of ["too_short", "same_as_identifier", "denylisted"] as const) {
      expect(describePasswordRefusal(refusal)).toMatch(/\w/);
    }
  });
});
