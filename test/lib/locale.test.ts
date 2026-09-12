import { describe, expect, it } from "@jest/globals";
import {
  htmlDir,
  htmlLang,
  otherUiLocale,
  parseUiLocale,
} from "@/lib/locale";

describe("parseUiLocale", () => {
  it("defaults to Arabic", () => {
    expect(parseUiLocale(undefined)).toBe("ar");
    expect(parseUiLocale("fr")).toBe("ar");
  });

  it("accepts en", () => {
    expect(parseUiLocale("en")).toBe("en");
  });
});

describe("html lang/dir", () => {
  it("maps ar to rtl and en to ltr", () => {
    expect(htmlLang("ar")).toBe("ar");
    expect(htmlDir("ar")).toBe("rtl");
    expect(htmlLang("en")).toBe("en");
    expect(htmlDir("en")).toBe("ltr");
    expect(otherUiLocale("ar")).toBe("en");
    expect(otherUiLocale("en")).toBe("ar");
  });
});
