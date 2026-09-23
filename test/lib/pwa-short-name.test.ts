import { describe, expect, it } from "@jest/globals";
import { pwaShortName } from "@/lib/pwa-short-name";

describe("pwaShortName", () => {
  it("cuts English names on a word boundary", () => {
    expect(pwaShortName("Ahmad Stadium")).toBe("Ahmad");
    expect(pwaShortName("North Pitch A")).toBe("North Pitch");
    expect(pwaShortName("Ahmad Stadiu")).toBe("Ahmad Stadiu");
  });

  it("keeps a long first English word as the full name", () => {
    expect(pwaShortName("Supercalifragilistic Stadium")).toBe(
      "Supercalifragilistic Stadium",
    );
  });

  it("cuts Arabic names on a word boundary", () => {
    expect(pwaShortName("ملعب أحمد الدولي")).toBe("ملعب أحمد");
  });

  it("keeps a long first Arabic word as the full name", () => {
    const longWord = "أ".repeat(13);
    expect(pwaShortName(`${longWord} ملعب`)).toBe(`${longWord} ملعب`);
  });
});
