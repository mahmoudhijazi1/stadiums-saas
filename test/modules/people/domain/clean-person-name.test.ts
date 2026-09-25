import { describe, expect, it } from "@jest/globals";
import { cleanPersonName } from "@/modules/people/domain/clean-person-name";

describe("cleanPersonName", () => {
  it("strips a combining mark at the start only", () => {
    expect(cleanPersonName("\u0650ali")).toBe("ali");
  });

  it("trims and collapses inner spaces", () => {
    expect(cleanPersonName("  أحمد   علي ")).toBe("أحمد علي");
  });

  it("keeps diacritics inside an Arabic name", () => {
    expect(cleanPersonName("م\u064Fحمد")).toBe("م\u064Fحمد");
    expect(cleanPersonName("أ\u064Eحمد")).toBe("أ\u064Eحمد");
  });
});
