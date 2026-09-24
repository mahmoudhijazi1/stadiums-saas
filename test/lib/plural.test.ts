import { describe, expect, it } from "@jest/globals";
import { plural } from "@/lib/plural";
import { countedForms } from "@/lib/ui-copy";

const gamesAr = countedForms("owner.games", "ar");
const gamesEn = countedForms("owner.games", "en");

describe("plural", () => {
  it("uses Arabic categories for 0, 1, 2, 3, 10, 11, and 100", () => {
    if (!gamesAr) throw new Error("missing Arabic game forms");
    expect(plural("ar", 0, gamesAr)).toBe("لا مباريات");
    expect(plural("ar", 1, gamesAr)).toBe("مباراة واحدة");
    expect(plural("ar", 2, gamesAr)).toBe("مباراتان");
    expect(plural("ar", 3, gamesAr)).toBe("3 مباريات");
    expect(plural("ar", 10, gamesAr)).toBe("10 مباريات");
    expect(plural("ar", 11, gamesAr)).toBe("11 مباراة");
    expect(plural("ar", 100, gamesAr)).toBe("100 مباراة");
  });

  it("uses English one and other, and the zero form for 0", () => {
    if (!gamesEn) throw new Error("missing English game forms");
    expect(plural("en", 0, gamesEn)).toBe("No games");
    expect(plural("en", 1, gamesEn)).toBe("1 game");
    expect(plural("en", 2, gamesEn)).toBe("2 games");
  });

  it("falls back to other when English has no zero form", () => {
    expect(
      plural("en", 0, { one: "{n} game", other: "{n} games" }),
    ).toBe("0 games");
  });
});
