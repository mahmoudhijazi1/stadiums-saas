import { describe, expect, it } from "@jest/globals";
import { buildIdentifier, parseLocalPart } from "@/modules/access/domain/identifier";

describe("parseLocalPart", () => {
  it.each([
    ["owner", "owner"],
    ["  Owner  ", "owner"],
    ["ahmad.owner", "ahmad.owner"],
    ["ahmad_2", "ahmad_2"],
    ["abu-ali", "abu-ali"],
    ["a", "a"],
    ["owner@sami", "owner"], // a typed suffix is dropped
    ["owner@", "owner"],
    ["a".repeat(32), "a".repeat(32)],
  ])("%j -> %j", (raw, expected) => {
    expect(parseLocalPart(raw)).toBe(expected);
  });

  it.each([
    [""],
    ["   "],
    ["@sami"],
    ["a--b"],
    ["a-.b"],
    ["-owner"],
    ["owner-"],
    ["owner."],
    ["has space"],
    ["ali!"],
    ["مالك"],
    ["a".repeat(33)],
  ])("refuses %j", (raw) => {
    expect(parseLocalPart(raw)).toBeNull();
  });
});

describe("buildIdentifier", () => {
  it("always uses the tenant slug, whatever suffix was typed", () => {
    expect(buildIdentifier("boss", "al-nour")).toBe("boss@al-nour");
    expect(buildIdentifier("boss@sami", "al-nour")).toBe("boss@al-nour");
    expect(buildIdentifier("Boss@AL-NOUR", "al-nour")).toBe("boss@al-nour");
  });

  it("is null for a refused local part", () => {
    expect(buildIdentifier("a--b", "al-nour")).toBeNull();
    expect(buildIdentifier("", "al-nour")).toBeNull();
  });
});
