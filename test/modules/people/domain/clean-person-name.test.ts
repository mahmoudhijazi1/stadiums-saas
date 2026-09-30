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

describe("cleanPersonName: invisible and control characters (security audit S-14)", () => {
  it("strips every bidi control", () => {
    const bidi = ["؜", "‎", "‏", "‪", "‫", "‬", "‭", "‮", "⁦", "⁧", "⁨", "⁩"];
    for (const mark of bidi) {
      expect(cleanPersonName(`Al${mark}i`)).toBe("Ali");
    }
    expect(cleanPersonName("‮ilahgab")).toBe("ilahgab");
  });

  it("strips zero-width space, BOM and C0/C1 controls", () => {
    expect(cleanPersonName("A​li﻿")).toBe("Ali");
    expect(cleanPersonName("A\u0000l\u0007i\u007F\u0085")).toBe("Ali");
  });

  it("turns tabs and newlines into one space", () => {
    expect(cleanPersonName("Ali\n\tHassan")).toBe("Ali Hassan");
  });

  it("keeps ZWJ and ZWNJ (needed for Arabic and Persian shaping)", () => {
    expect(cleanPersonName("مه‌دی")).toBe("مه‌دی");
    expect(cleanPersonName("a‍b")).toBe("a‍b");
  });

  it("a name of only invisible characters becomes empty", () => {
    expect(cleanPersonName("​‮﻿ ")).toBe("");
  });
});
