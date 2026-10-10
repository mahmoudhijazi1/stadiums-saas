import { describe, expect, it } from "@jest/globals";
import { COPY_AREAS } from "@/lib/copy/ui";

describe("copy areas", () => {
  for (const [name, area] of Object.entries(COPY_AREAS)) {
    it(`${name}: Arabic and English have exactly the same keys`, () => {
      expect(Object.keys(area.en).sort()).toEqual(Object.keys(area.ar).sort());
    });
  }

  it("no key appears in two areas", () => {
    const seen = new Map<string, string>();
    const twice: string[] = [];
    for (const [name, area] of Object.entries(COPY_AREAS)) {
      for (const key of Object.keys(area.ar)) {
        if (seen.has(key)) twice.push(`${key} in ${seen.get(key)} and ${name}`);
        seen.set(key, name);
      }
    }
    expect(twice).toEqual([]);
  });

  it("no area has an empty string", () => {
    for (const area of Object.values(COPY_AREAS)) {
      for (const text of [...Object.values(area.ar), ...Object.values(area.en)]) expect(text).not.toBe("");
    }
  });
});
