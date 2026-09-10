import { describe, expect, it } from "@jest/globals";
import {
  normalizeIdentifier,
  parseLoginIdentifier,
} from "@/modules/access/domain/identifier";

describe("normalizeIdentifier", () => {
  it("trims and lower-cases so Owner@Ahmad matches the stored row", () => {
    expect(normalizeIdentifier("  Owner@Ahmad  ")).toBe("owner@ahmad");
  });
});

describe("parseLoginIdentifier", () => {
  it("accepts local@slug", () => {
    expect(parseLoginIdentifier("owner@ahmad")).toEqual({
      local: "owner",
      slug: "ahmad",
    });
    expect(parseLoginIdentifier("Staff@Sami")).toEqual({
      local: "staff",
      slug: "sami",
    });
  });

  it("rejects missing parts, spaces in local, and a bad slug", () => {
    expect(parseLoginIdentifier("owner")).toBeNull();
    expect(parseLoginIdentifier("@ahmad")).toBeNull();
    expect(parseLoginIdentifier("owner@")).toBeNull();
    expect(parseLoginIdentifier("owner@ahmad@x")).toBeNull();
    expect(parseLoginIdentifier("own er@ahmad")).toBeNull();
    expect(parseLoginIdentifier("owner@Bad_Slug")).toBeNull();
  });
});
