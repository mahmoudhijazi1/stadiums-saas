import { describe, expect, it } from "@jest/globals";
import { normalizeName } from "@/modules/people/domain/normalize-name";

describe("normalizeName", () => {
  it("folds Arabic alef, diacritics, tatweel, alef maksura, and teh marbuta", () => {
    const folded = normalizeName("احمد");
    expect(normalizeName("أحمد")).toBe(folded);
    expect(normalizeName("إحمد")).toBe(folded);
    expect(normalizeName("آحمد")).toBe(folded);
    expect(normalizeName("أَحْمَد")).toBe(folded);
    expect(normalizeName("احمـد")).toBe(folded);
    expect(normalizeName("  أحمد  ")).toBe(folded);
    expect(normalizeName("على")).toBe(normalizeName("علي"));
    expect(normalizeName("فاطمة")).toBe(normalizeName("فاطمه"));
  });

  it("ignores Latin case and collapses spaces", () => {
    expect(normalizeName("John")).toBe("john");
    expect(normalizeName("JOHN")).toBe(normalizeName("john"));
    expect(normalizeName("  Mary   Ann ")).toBe("mary ann");
  });
});
