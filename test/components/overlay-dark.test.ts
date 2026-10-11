import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), "src", ...parts), "utf8");

describe("sheet and modal backdrop", () => {
  it("darkens in the dark theme instead of lightening (foreground is light there)", () => {
    const dialog = read("components", "ui", "dialog.tsx");
    expect(dialog).toContain("bg-foreground/45");
    expect(dialog).toMatch(/dark:bg-black\/\d+/);
  });

  it("every sheet and modal shares that one overlay", () => {
    expect(read("components", "ui", "bottom-sheet.tsx")).toContain("DialogOverlay");
    expect(read("components", "ui", "dialog.tsx")).toContain("<DialogOverlay />");
  });
});
